"""Environment-driven settings for the worker."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the working directory or the worker package root.
_here = Path(__file__).resolve().parent.parent
for candidate in (Path.cwd() / ".env", _here / ".env"):
    if candidate.exists():
        load_dotenv(candidate, override=False)
        break


def _required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(
            f"Missing required env var {key}. Copy worker/.env.example to .env and fill it in."
        )
    return val


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    worker_name: str
    worker_env: str
    worker_version: str
    poll_interval_seconds: float
    heartbeat_interval_seconds: float
    log_flush_interval_seconds: float
    headless: bool


settings = Settings(
    supabase_url=_required("SUPABASE_URL"),
    supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
    worker_name=os.getenv("WORKER_NAME", "unnamed-worker"),
    worker_env=os.getenv("WORKER_ENV", "production"),
    worker_version=os.getenv("WORKER_VERSION", "0.1.0"),
    poll_interval_seconds=float(os.getenv("POLL_INTERVAL_SECONDS", "5")),
    heartbeat_interval_seconds=float(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "10")),
    log_flush_interval_seconds=float(os.getenv("LOG_FLUSH_INTERVAL_SECONDS", "1")),
    headless=os.getenv("HEADLESS", "true").lower() not in ("false", "0", "no"),
)
