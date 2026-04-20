"""Maps job_type strings to AgentClass implementations.

Add new agents here. The worker looks up `REGISTRY[job["job_type"]]` to
decide what to run. Unknown types fail the job with a clear error.
"""

from __future__ import annotations

from typing import Dict, Type

from .agents.base import BaseAgent
from .agents.client_enrichment import ClientEnrichmentAgent
from .agents.contact_web_enrich import ContactWebEnrichAgent
from .agents.email_lookup import EmailLookupAgent
from .agents.hello import HelloAgent
from .agents.tedx_scrape import TedxScrapeAgent

REGISTRY: Dict[str, Type[BaseAgent]] = {
    HelloAgent.job_type: HelloAgent,
    TedxScrapeAgent.job_type: TedxScrapeAgent,
    ClientEnrichmentAgent.job_type: ClientEnrichmentAgent,
    EmailLookupAgent.job_type: EmailLookupAgent,
    ContactWebEnrichAgent.job_type: ContactWebEnrichAgent,
}
