"""Streams agent log messages to the `job_logs` table.

Buffers locally and flushes every N seconds (default 1s) so we don't slam
Supabase with one INSERT per log line. Also flushes on stop().
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import List, Optional

from .config import settings
from .supabase_client import get_client


@dataclass
class _LogEntry:
    job_id: str
    worker_id: Optional[str]
    level: str
    message: str


class JobLogger:
    def __init__(self, job_id: str, worker_id: str) -> None:
        self._sb = get_client()
        self._job_id = job_id
        self._worker_id = worker_id
        self._buffer: List[_LogEntry] = []
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task] = None
        self._stopped = asyncio.Event()

    async def start(self) -> None:
        self._task = asyncio.create_task(self._flush_loop())

    async def stop(self) -> None:
        self._stopped.set()
        if self._task:
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.flush_now()

    async def log(self, level: str, message: str) -> None:
        # Always print to stdout for systemd journal visibility.
        print(f"[job {self._job_id[:8]}] [{level}] {message}")
        async with self._lock:
            self._buffer.append(
                _LogEntry(
                    job_id=self._job_id,
                    worker_id=self._worker_id,
                    level=level,
                    message=message[:8000],
                )
            )

    def log_sync(self, level: str, message: str) -> None:
        """Sync wrapper for use from inside synchronous agent code paths."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.log(level, message))
        except RuntimeError:
            # No loop running (e.g. called from threadpool worker). Best-effort
            # fire-and-forget direct insert.
            try:
                self._sb.table("job_logs").insert(
                    {
                        "job_id": self._job_id,
                        "worker_id": self._worker_id,
                        "level": level,
                        "message": message[:8000],
                    }
                ).execute()
            except Exception as exc:  # noqa: BLE001
                print(f"[joblog] sync insert failed: {exc}")

    async def _flush_loop(self) -> None:
        interval = settings.log_flush_interval_seconds
        while not self._stopped.is_set():
            await asyncio.sleep(interval)
            await self.flush_now()

    async def flush_now(self) -> None:
        async with self._lock:
            if not self._buffer:
                return
            rows = [
                {
                    "job_id": e.job_id,
                    "worker_id": e.worker_id,
                    "level": e.level,
                    "message": e.message,
                }
                for e in self._buffer
            ]
            self._buffer.clear()
        try:
            await asyncio.to_thread(
                lambda: self._sb.table("job_logs").insert(rows).execute()
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[joblog] flush failed ({len(rows)} entries): {exc}")
