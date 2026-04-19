"""Trivial smoke-test agent. Useful to confirm the loop works end-to-end
without depending on Playwright or external sites.

Queue a job with job_type='hello' and any payload — it just sleeps 3s and
returns success.
"""

from __future__ import annotations

import asyncio

from .base import AgentContext, AgentResult, BaseAgent


class HelloAgent(BaseAgent):
    job_type = "hello"

    async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:
        ctx.log("info", "HelloAgent says hi 👋")
        ctx.log("debug", f"received payload: {payload}")
        for i in range(3):
            await asyncio.sleep(1)
            ctx.log("info", f"working... {i + 1}/3")
        ctx.log("info", "all done")
        return AgentResult(
            records_created=0,
            errors_count=0,
            summary="HelloAgent ran successfully — pipeline is healthy.",
        )
