"""Job pickup. Strategy:

1.  On startup, immediately try to claim a job (catch up on anything queued
    while we were offline).
2.  Subscribe to Realtime INSERT events on `public.jobs` — when one fires,
    try to claim. If another worker beat us to it, claim_next_job returns
    NULL and we go back to waiting.
3.  Poll every N seconds as a safety net (covers Realtime hiccups, restarts,
    and rows that became eligible due to other state changes).

`claim_next_job` is a SECURITY DEFINER Postgres function using
FOR UPDATE SKIP LOCKED — guaranteed atomic, two workers can never grab the
same row.
"""

from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, Iterable, Optional

from realtime._async.channel import AsyncRealtimeChannel  # type: ignore

from .config import settings
from .supabase_client import get_client


JobHandler = Callable[[dict], Awaitable[None]]


class JobClaimer:
    def __init__(self, worker_id: str, supported_types: Iterable[str]) -> None:
        self._sb = get_client()
        self._worker_id = worker_id
        self._supported_types = list(supported_types)
        self._wakeup = asyncio.Event()
        self._channel: Optional[AsyncRealtimeChannel] = None

    def _try_claim(self) -> Optional[dict]:
        resp = self._sb.rpc(
            "claim_next_job",
            {
                "p_worker_id": self._worker_id,
                "p_job_types": self._supported_types,
            },
        ).execute()
        data = resp.data
        # Postgres function returning a row → supabase-py wraps it as a list of dicts
        # or a single dict depending on PostgREST behavior.
        if isinstance(data, list):
            row = data[0] if data else None
        else:
            row = data
        if row and row.get("id"):
            return row
        return None

    async def _subscribe_realtime(self) -> None:
        """Wake the loop whenever a new queued job is inserted."""
        try:
            channel = self._sb.realtime.channel("worker-jobs-stream")  # type: ignore[attr-defined]
            channel.on_postgres_changes(
                event="INSERT",
                schema="public",
                table="jobs",
                callback=lambda _payload: self._wakeup.set(),
            )
            await channel.subscribe()
            self._channel = channel
            print("[claimer] realtime subscription active")
        except Exception as exc:  # noqa: BLE001
            # Realtime is best-effort. Polling will still catch jobs.
            print(f"[claimer] realtime unavailable, falling back to polling: {exc}")

    async def run(self, on_job: JobHandler, stop_event: asyncio.Event) -> None:
        await self._subscribe_realtime()
        # Process one job at a time. Workers stay simple; horizontal scaling = run
        # more worker processes/machines.
        while not stop_event.is_set():
            try:
                job = await asyncio.to_thread(self._try_claim)
            except Exception as exc:  # noqa: BLE001
                print(f"[claimer] claim error: {exc}")
                job = None

            if job:
                print(f"[claimer] claimed job {job['id']} ({job['job_type']})")
                try:
                    await on_job(job)
                except Exception as exc:  # noqa: BLE001
                    print(f"[claimer] handler crashed: {exc}")
                # Immediately try again — there might be more queued.
                self._wakeup.set()

            # Wait for either a realtime nudge, the poll interval, or shutdown.
            try:
                await asyncio.wait_for(
                    self._wakeup.wait(), timeout=settings.poll_interval_seconds
                )
            except asyncio.TimeoutError:
                pass
            self._wakeup.clear()

        if self._channel is not None:
            try:
                await self._channel.unsubscribe()
            except Exception:  # noqa: BLE001
                pass
