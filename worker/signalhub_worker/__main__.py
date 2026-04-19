"""Entry point: `python -m signalhub_worker`.

Starts the heartbeat loop, the realtime job-claim loop, and the polling
fallback. Dispatches claimed jobs to the agent registry.
"""

from __future__ import annotations

import asyncio
import signal
import traceback

from .config import settings
from .supabase_client import get_client
from .heartbeat import HeartbeatLoop
from .claimer import JobClaimer
from .logger import JobLogger
from .registry import REGISTRY
from .agents.base import AgentContext, AgentResult


async def execute_job(job: dict, worker_id: str) -> None:
    """Resolve the agent for a job, run it, and finalize via complete_job."""
    sb = get_client()
    job_id: str = job["id"]
    job_type: str = job["job_type"]
    payload: dict = job.get("payload") or {}

    job_logger = JobLogger(job_id=job_id, worker_id=worker_id)
    await job_logger.start()

    AgentClass = REGISTRY.get(job_type)
    if AgentClass is None:
        await job_logger.log(
            "error",
            f"No agent registered for job_type='{job_type}'. Available: {sorted(REGISTRY.keys())}",
        )
        await job_logger.flush_now()
        await job_logger.stop()
        sb.rpc(
            "complete_job",
            {
                "p_job_id": job_id,
                "p_status": "failed",
                "p_records_created": 0,
                "p_errors_count": 1,
                "p_notes": f"Unknown job_type '{job_type}' — worker has no agent for it.",
            },
        ).execute()
        return

    ctx = AgentContext(
        job=job,
        worker_id=worker_id,
        supabase=sb,
        log=job_logger.log_sync,
    )

    print(f"[execute] starting {job_type} (job_id={job_id})")
    try:
        agent = AgentClass()
        result: AgentResult = await agent.run(payload, ctx)
        await job_logger.log(
            "info",
            f"Agent finished: {result.records_created} records, {result.errors_count} errors.",
        )
        await job_logger.flush_now()
        sb.rpc(
            "complete_job",
            {
                "p_job_id": job_id,
                "p_status": "succeeded" if result.errors_count == 0 or result.records_created > 0 else "failed",
                "p_records_created": int(result.records_created),
                "p_errors_count": int(result.errors_count),
                "p_notes": result.summary[:1000] if result.summary else None,
            },
        ).execute()
        print(f"[execute] ✓ done {job_id} — {result.records_created} records")
    except Exception as exc:  # noqa: BLE001 - top-level safety net
        tb = traceback.format_exc()
        print(f"[execute] ✗ {job_id} crashed: {exc}\n{tb}")
        await job_logger.log("error", f"Agent crashed: {exc}")
        await job_logger.log("debug", tb[-2000:])
        await job_logger.flush_now()
        sb.rpc(
            "complete_job",
            {
                "p_job_id": job_id,
                "p_status": "failed",
                "p_records_created": 0,
                "p_errors_count": 1,
                "p_notes": str(exc)[:1000],
            },
        ).execute()
    finally:
        await job_logger.stop()


async def main() -> None:
    print(f"[boot] SignalHub worker '{settings.worker_name}' starting...")
    print(f"[boot] supabase: {settings.supabase_url}")
    print(f"[boot] registered job types: {sorted(REGISTRY.keys())}")

    heartbeat = HeartbeatLoop()
    worker_id = await heartbeat.register()  # registers row, returns workers.id
    asyncio.create_task(heartbeat.run())

    claimer = JobClaimer(worker_id=worker_id, supported_types=list(REGISTRY.keys()))

    stop_event = asyncio.Event()

    def _shutdown() -> None:
        print("\n[shutdown] signal received, draining...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _shutdown)
        except NotImplementedError:
            pass  # Windows

    async def on_job(job: dict) -> None:
        # Mark worker busy via heartbeat upsert
        await heartbeat.set_busy(job["id"])
        try:
            await execute_job(job, worker_id)
        finally:
            await heartbeat.set_idle()

    await claimer.run(on_job, stop_event)
    print("[shutdown] stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
