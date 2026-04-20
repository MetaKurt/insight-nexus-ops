"""Contact web enrichment agent — discovers each contact's real employer.

Why this agent exists:
    The TEDx scraper grabs whatever URL is on the organizer's TED profile,
    which is mostly Facebook event pages or YouTube channels — NOT the
    company they work for. Hunter.io needs a real company domain to find
    emails, so without this stage Hunter returns nothing useful.

What it does:
    For each contact missing a real company website (or with one of the
    blocked social domains), runs a Firecrawl Search query like:

        "Jane Smith" "TEDxBrooklyn" organizer LinkedIn

    Then scrapes the top results, looks at all the links/text on those
    pages, and extracts:

      - LinkedIn URL  -> contacts.linkedin_url
      - Company website domain -> contacts.website
      - Company name -> contacts.organization (only if currently empty
                        or a TEDx-style placeholder)

    After this runs, Hunter (Stage 4) has a real `acme.com` to query
    instead of `facebook.com/events/...`.

Pipeline position:
    Stage 1: tedx_scrape         -> events
    Stage 2: client_enrichment   -> contacts (no good domains)
    Stage 3: contact_web_enrich  -> THIS — adds LinkedIn + employer + domain
    Stage 4: email_lookup        -> Hunter.io now has real domains to query

Payload knobs (all optional):
    - mission_id, mission_stage_id   uuid    auto-injected
    - depends_on_stage_id            uuid    auto-injected; scopes contacts
    - projectId / project_id         uuid    only enrich contacts in project
    - contact_ids                    [uuid]  enrich specific contacts only
    - max_lookups                    int     hard cap on Firecrawl calls
    - force_reenrich                 bool    redo contacts that already have linkedin/website
    - rate_limit_per_min             int     politeness gate (default 30)
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx

from .base import AgentContext, AgentResult, BaseAgent


FIRECRAWL_BASE = "https://api.firecrawl.dev/v2"
FIRECRAWL_API_KEY_ENV = "FIRECRAWL_API_KEY"

# Domains that are NOT real employer websites — we treat them as "no domain"
# so we'll trigger a web search to find a real one.
_BLOCKED_DOMAINS = {
    "ted.com", "www.ted.com",
    "linkedin.com", "www.linkedin.com",
    "twitter.com", "www.twitter.com", "x.com",
    "facebook.com", "www.facebook.com", "fb.com",
    "instagram.com", "www.instagram.com",
    "youtube.com", "www.youtube.com", "youtu.be",
    "tiktok.com", "www.tiktok.com",
    "eventbrite.com", "www.eventbrite.com",
    "meetup.com", "www.meetup.com",
    "wikipedia.org", "en.wikipedia.org",
    "medium.com", "www.medium.com",
}

# Strings in the organization field that we treat as "no real employer set".
# If org matches one of these, we'll overwrite it with what Firecrawl finds.
_PLACEHOLDER_ORG_PATTERNS = (
    re.compile(r"^tedx", re.IGNORECASE),
    re.compile(r"^ted ", re.IGNORECASE),
)


def _domain_of(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        netloc = urlparse(url if "://" in url else f"https://{url}").netloc.lower()
    except Exception:  # noqa: BLE001
        return None
    netloc = netloc.lstrip("www.")
    return netloc or None


def _is_real_company_domain(url: Optional[str]) -> bool:
    d = _domain_of(url)
    if not d or "." not in d:
        return False
    return d not in _BLOCKED_DOMAINS


def _is_placeholder_org(org: Optional[str]) -> bool:
    if not org or not org.strip():
        return True
    return any(p.search(org) for p in _PLACEHOLDER_ORG_PATTERNS)


class ContactWebEnrichAgent(BaseAgent):
    job_type = "contact_web_enrich"

    AGENT_VERSION = "2026-04-19.v1-firecrawl"
    DEFAULT_RATE_LIMIT_PER_MIN = 30
    SEARCH_LIMIT = 5  # how many Firecrawl results per contact

    async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:
        ctx.log("info", f"contact_web_enrich agent v={self.AGENT_VERSION}")

        api_key = os.getenv(FIRECRAWL_API_KEY_ENV, "").strip()
        if not api_key:
            ctx.log("error", f"{FIRECRAWL_API_KEY_ENV} env var is missing on the worker.")
            return AgentResult(0, 1, f"Missing {FIRECRAWL_API_KEY_ENV}.")

        sb = ctx.supabase

        project_id: Optional[str] = payload.get("projectId") or payload.get("project_id")
        contact_ids = payload.get("contact_ids") or None
        max_lookups = payload.get("max_lookups")
        try:
            max_lookups = int(max_lookups) if max_lookups is not None else None
        except (TypeError, ValueError):
            max_lookups = None
        force_reenrich = bool(payload.get("force_reenrich", False))
        try:
            rate_per_min = int(payload.get("rate_limit_per_min") or self.DEFAULT_RATE_LIMIT_PER_MIN)
        except (TypeError, ValueError):
            rate_per_min = self.DEFAULT_RATE_LIMIT_PER_MIN
        rate_per_min = max(1, min(rate_per_min, 600))
        sleep_between = 60.0 / rate_per_min

        ctx.log(
            "info",
            f"Params — project={project_id} max_lookups={max_lookups} "
            f"force_reenrich={force_reenrich} rate_per_min={rate_per_min}",
        )

        contacts = self._select_contacts(
            sb, ctx,
            project_id=project_id,
            contact_ids=contact_ids,
            force_reenrich=force_reenrich,
        )
        if not contacts:
            ctx.log("info", "No contacts need web enrichment. Done.")
            return AgentResult(0, 0, "Nothing to enrich.")

        ctx.log("info", f"Selected {len(contacts)} contacts for web enrichment.")

        updated = 0
        not_found = 0
        errors = 0
        lookups_done = 0

        async with httpx.AsyncClient(timeout=45.0) as client:
            for i, contact in enumerate(contacts, start=1):
                if max_lookups is not None and lookups_done >= max_lookups:
                    ctx.log("info", f"Hit max_lookups cap ({max_lookups}). Stopping.")
                    break

                name = (contact.get("name") or "").strip()
                if not name or len(name.split()) < 2:
                    ctx.log("debug", f"[{i}/{len(contacts)}] skip {name!r} — needs full name")
                    continue

                # Build a search that biases for a person's professional info.
                org_hint = (contact.get("organization") or "").strip()
                query_parts = [f'"{name}"']
                if org_hint:
                    query_parts.append(f'"{org_hint}"')
                query_parts.append("LinkedIn")
                query = " ".join(query_parts)

                try:
                    results = await self._firecrawl_search(client, api_key, query)
                    lookups_done += 1
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    ctx.log("error", f"[{i}/{len(contacts)}] {name} — Firecrawl error: {exc}")
                    await asyncio.sleep(sleep_between)
                    continue

                update = self._extract_signals(results, name)

                if not update:
                    not_found += 1
                    ctx.log("info", f"[{i}/{len(contacts)}] {name} — no signals found")
                else:
                    # Only overwrite organization if the existing one is a placeholder.
                    if "organization" in update and not _is_placeholder_org(contact.get("organization")):
                        update.pop("organization", None)
                    # Only set website if the contact doesn't already have a real one.
                    if "website" in update and _is_real_company_domain(contact.get("website")):
                        update.pop("website", None)
                    # Only set linkedin_url if currently empty.
                    if "linkedin_url" in update and (contact.get("linkedin_url") or "").strip():
                        update.pop("linkedin_url", None)

                if update:
                    update["enriched_at"] = datetime.now(timezone.utc).isoformat()
                    update["enrichment_provider"] = "firecrawl"
                    try:
                        sb.table("contacts").update(update).eq("id", contact["id"]).execute()
                        updated += 1
                        ctx.log(
                            "info",
                            f"[{i}/{len(contacts)}] {name} → "
                            f"linkedin={'Y' if update.get('linkedin_url') else '-'} "
                            f"website={update.get('website') or '-'} "
                            f"org={update.get('organization') or '-'}",
                        )
                    except Exception as exc:  # noqa: BLE001
                        errors += 1
                        ctx.log("error", f"DB write failed for {contact['id']}: {exc}")

                await asyncio.sleep(sleep_between)

        summary = (
            f"Firecrawl lookups: {lookups_done} — {updated} contacts enriched, "
            f"{not_found} no useful signals, {errors} errors."
        )
        ctx.log("info", summary)
        return AgentResult(records_created=updated, errors_count=errors, summary=summary)

    # ── Selection ─────────────────────────────────────────────────────
    def _select_contacts(
        self,
        sb,
        ctx: AgentContext,
        *,
        project_id: Optional[str],
        contact_ids: Optional[list[str]],
        force_reenrich: bool,
    ) -> list[dict]:
        q = sb.table("contacts").select(
            "id, name, organization, website, linkedin_url, project_id, finding_id, enriched_at"
        )
        if contact_ids:
            q = q.in_("id", contact_ids)
        if project_id:
            q = q.eq("project_id", project_id)

        try:
            rows = q.limit(5000).execute().data or []
        except Exception as exc:  # noqa: BLE001
            ctx.log("error", f"Could not select contacts: {exc}")
            return []

        if force_reenrich:
            return rows

        # Default: only enrich contacts that lack BOTH a real company website
        # AND a LinkedIn URL — the ones Hunter would otherwise fail on.
        keep: list[dict] = []
        for r in rows:
            has_real_site = _is_real_company_domain(r.get("website"))
            has_linkedin = bool((r.get("linkedin_url") or "").strip())
            if not has_real_site or not has_linkedin:
                keep.append(r)
        ctx.log("info", f"Filter — kept {len(keep)} of {len(rows)} contacts (missing real site or LinkedIn)")
        return keep

    # ── Firecrawl call ────────────────────────────────────────────────
    async def _firecrawl_search(
        self, client: httpx.AsyncClient, api_key: str, query: str,
    ) -> list[dict]:
        r = await client.post(
            f"{FIRECRAWL_BASE}/search",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "query": query,
                "limit": self.SEARCH_LIMIT,
                # Don't ask Firecrawl to scrape the pages — too slow and we just
                # need URLs + titles + snippets to extract the signals we want.
            },
        )
        r.raise_for_status()
        body = r.json() or {}
        # Firecrawl v2 returns results under `data.web` (newer schema) or
        # under `data` directly (older); handle both.
        data = body.get("data")
        if isinstance(data, dict):
            return data.get("web") or data.get("results") or []
        if isinstance(data, list):
            return data
        return []

    # ── Signal extraction ─────────────────────────────────────────────
    @staticmethod
    def _extract_signals(results: list[dict], person_name: str) -> dict:
        """Pull a LinkedIn URL, company domain, and company name out of search hits."""
        linkedin_url: Optional[str] = None
        company_domain: Optional[str] = None
        company_name: Optional[str] = None

        # Build a normalised version of the person's name so we can pattern-match
        # a LinkedIn slug like /in/jane-smith/.
        name_slug = re.sub(r"[^a-z]+", "-", person_name.lower()).strip("-")

        for hit in results:
            url = (hit.get("url") or "").strip()
            title = (hit.get("title") or "").strip()
            description = (hit.get("description") or hit.get("snippet") or "").strip()
            if not url:
                continue
            domain = _domain_of(url)

            # 1) LinkedIn — prefer /in/ profile URLs that include part of the name.
            if not linkedin_url and domain and "linkedin.com" in domain and "/in/" in url:
                slug_match = re.search(r"/in/([^/?#]+)", url)
                if slug_match:
                    slug = slug_match.group(1).lower()
                    # Loose match: require at least one name token to overlap.
                    name_tokens = [t for t in re.split(r"[-_]", name_slug) if len(t) > 2]
                    if any(tok in slug for tok in name_tokens):
                        linkedin_url = url.split("?")[0]
                        # Try to pull "at Acme Corp" out of the LinkedIn title.
                        m = re.search(r"\bat\s+([A-Z][\w&. ]{2,60})", title)
                        if m and not company_name:
                            company_name = m.group(1).strip().rstrip(".|-")

            # 2) Company website — a non-blocked domain that's NOT linkedin/social.
            if not company_domain and domain and domain not in _BLOCKED_DOMAINS:
                # Skip obvious news / aggregator hits.
                if any(bad in domain for bad in ("news", "blog.", "wordpress.")):
                    continue
                company_domain = domain
                # Often the title looks like "About — Acme Corp" or "Acme Corp | Home"
                if not company_name:
                    title_clean = re.split(r"[|\-—–·]", title)[-1].strip()
                    if 2 < len(title_clean) < 60 and not title_clean.lower().startswith("http"):
                        company_name = title_clean

            # 3) Description sometimes contains "Jane Smith is the CEO of Acme Corp".
            if not company_name and description:
                m = re.search(r"\b(?:CEO|founder|director|head|VP|owner|president)\s+of\s+([A-Z][\w&. ]{2,60})", description, re.IGNORECASE)
                if m:
                    company_name = m.group(1).strip().rstrip(".|-")

        out: dict = {}
        if linkedin_url:
            out["linkedin_url"] = linkedin_url
        if company_domain:
            # Store as bare domain (Hunter normalises this anyway).
            out["website"] = company_domain
        if company_name:
            out["organization"] = company_name
        return out
