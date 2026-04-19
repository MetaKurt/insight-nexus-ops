"""Heartbeat loop: every N seconds, upserts the `workers` row via the
`worker_heartbeat` RPC. The RPC uses ON CONFLICT (machine_name) so it's
idempotent and survives restarts.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from .config import settings
from .supabase_client import get_client


class HeartbeatLoop:
    def __init__(self) -> None:
        self._sb = get_client()
        self._status = "idle"
        self._current_job_id: Optional[str] = None
        self._worker_id: Optional[str] = None

    async def register(self) -> str:
        """Initial registration. Returns the workers.id row UUID."""
        row = self._call_rpc()
        self._worker_id = row["id"]
        print(f"[heartbeat] registered as {settings.worker_name} (id={self._worker_id})")
        return self._worker_id  # type: ignore[return-value]

    def _call_rpc(self) -> dict:
        resp = self._sb.rpc(
            "worker_heartbeat",
            {
                "p_machine_name": settings.worker_name,
                "p_version": settings.worker_version,
                "p_environment": settings.worker_env,
                "p_status": self._status,
                "p_current_job_id": self._current_job_id,
            },
        ).execute()
        data = resp.data
        if isinstance(data, list):
            return data[0] if data else {}
        return data or {}

    async def set_busy(self, job_id: str) -> None:
        self._status = "busy"
        self._current_job_id = job_id
        await asyncio.to_thread(self._call_rpc)

    async def set_idle(self) -> None:
        self._status = "idle"
        self._current_job_id = None
        await asyncio.to_thread(self._call_rpc)

    async def run(self) -> None:
        """Long-running heartbeat loop."""
        interval = settings.heartbeat_interval_seconds
        while True:
            try:
                await asyncio.to_thread(self._call_rpc)
            except Exception as exc:  # noqa: BLE001
                print(f"[heartbeat] error: {exc}")
            await asyncio.sleep(interval)
