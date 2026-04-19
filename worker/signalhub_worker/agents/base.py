"""Agent base class and shared types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from supabase import Client


@dataclass
class AgentResult:
    records_created: int = 0
    errors_count: int = 0
    summary: str = ""


@dataclass
class AgentContext:
    job: dict
    worker_id: str
    supabase: Client
    log: Callable[[str, str], None]  # (level, message) -> None, fire-and-forget


class BaseAgent:
    """Base class — subclasses override `job_type` and implement `run`."""

    job_type: str = "base"

    async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:  # noqa: ARG002
        raise NotImplementedError
