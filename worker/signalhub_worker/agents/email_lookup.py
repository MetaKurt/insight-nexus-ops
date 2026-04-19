"""Email lookup agent — enriches contacts with Hunter.io.

Stage 3 of the TEDx pipeline:

    Stage 1: tedx_scrape       → events (`findings`)
    Stage 2: client_enrichment → organizers (`contacts`, no emails)
    Stage 3: email_lookup      → adds email + LinkedIn + Twitter + verification
                                  via Hunter.io's Email Finder API.

Behaviour:
- Picks all contacts in scope where email IS NULL.
- For each contact: try to derive a domain (contacts.website → event finding's
  source URL → Hunter Domain Search by organization name as a last resort),
  then call Hunter Email Finder with first_name + last_name + domain.
- Writes back: email, email_score, email_verification_status, linkedin_url,
  twitter_url, phone, enrichment_sources, enriched_at, enrichment_provider.
- Skip-if-recent: contacts whose `enriched_at` is within `skip_if_within_days`
  (default 90) are skipped, unless `force_reenrich` is true.

Payload knobs (all optional):
- mission_id            uuid    auto-injected
- mission_stage_id      uuid    auto-injected
- depends_on_stage_id   uuid    auto-injected; used to scope the contact list
- projectId             uuid    only enrich contacts of this project
- contact_ids           [uuid]  enrich only these specific contacts
- max_lookups           int     hard cap on Hunter API calls (default unlimited)
- skip_if_within_days   int     skip contacts enriched within this window (default 90)
- force_reenrich        bool    ignore skip-if-recent (default False)
- rate_limit_per_min    int     Hunter API politeness (default 15 = free tier)
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx

from .base import AgentContext, AgentResult, BaseAgent


HUNTER_BASE = "https://api.hunter.io/v2"
HUNTER_API_KEY_ENV = "HUNTER_API_KEY"

# Domains we should never treat as "the contact's company" — these are the
# scrape sources, not employer websites.
_BLOCKED_DOMAINS = {"ted.com", "www.ted.com", "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com"}


def _split_name(full: str) -> tuple[str, str]:
    parts = re.sub(r"\s+", " ", (full or "")).strip().split(" ")
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _domain_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        netloc = urlparse(url if "://" in url else f"https://{url}").netloc.lower()
    except Exception:  # noqa: BLE001
        return None
    netloc = netloc.lstrip("www.")
    if not netloc or "." not in netloc:
        return None
    if netloc in _BLOCKED_DOMAINS:
        return None
    return netloc


class EmailLookupAgent(BaseAgent):
    job_type = "email_lookup"

    AGENT_VERSION = "2026-04-19.v1-hunter"
    DEFAULT_SKIP_DAYS = 90
    DEFAULT_RATE_LIMIT_PER_MIN = 15

    async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:
        ctx.log("info", f"email_lookup agent v={self.AGENT_VERSION}")

        api_key = os.getenv(HUNTER_API_KEY_ENV, "").strip()
        if not api_key:
            ctx.log("error", f"{HUNTER_API_KEY_ENV} env var is missing on the worker.")
            return AgentResult(0, 1, f"Missing {HUNTER_API_KEY_ENV}.")

        sb = ctx.supabase

        # ── Resolve payload knobs ──────────────────────────────────────
        project_id: Optional[str] = payload.get("projectId") or payload.get("project_id")
        contact_ids = payload.get("contact_ids") or None
        max_lookups = payload.get("max_lookups")
        try:
            max_lookups = int(max_lookups) if max_lookups is not None else None
        except (TypeError, ValueError):
            max_lookups = None
        try:
            skip_days = int(payload.get("skip_if_within_days") or self.DEFAULT_SKIP_DAYS)
        except (TypeError, ValueError):
            skip_days = self.DEFAULT_SKIP_DAYS
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
            f"skip_days={skip_days} force_reenrich={force_reenrich} "
            f"rate_per_min={rate_per_min}",
        )

        # ── Pick contacts to enrich ────────────────────────────────────
        contacts = self._select_contacts(
            sb, ctx,
            project_id=project_id,
            contact_ids=contact_ids,
            skip_days=skip_days,
            force_reenrich=force_reenrich,
        )
        if not contacts:
            ctx.log("info", "No contacts need email lookup. Done.")
            return AgentResult(0, 0, "Nothing to enrich.")

        ctx.log("info", f"Selected {len(contacts)} contacts for email lookup.")

        # Pre-load the related findings so we can fall back to event URLs for domain derivation.
        finding_ids = list({c["finding_id"] for c in contacts if c.get("finding_id")})
        finding_map: dict[str, dict] = {}
        if finding_ids:
            try:
                fres = sb.table("findings").select("id, source_url, title, data").in_("id", finding_ids).execute()
                for f in (fres.data or []):
                    finding_map[f["id"]] = f
            except Exception as exc:  # noqa: BLE001
                ctx.log("warning", f"Could not preload findings: {exc}")

        found = 0
        not_found = 0
        errors = 0
        lookups_done = 0

        async with httpx.AsyncClient(timeout=20.0) as client:
            for i, contact in enumerate(contacts, start=1):
                if max_lookups is not None and lookups_done >= max_lookups:
                    ctx.log("info", f"Hit max_lookups cap ({max_lookups}). Stopping.")
                    break

                name = (contact.get("name") or "").strip()
                first, last = _split_name(name)
                if not first or not last:
                    ctx.log("debug", f"[{i}/{len(contacts)}] skip {name!r} — needs first AND last name")
                    continue

                # Domain priority: contact.website → finding.source_url → org-name search
                domain = _domain_from_url(contact.get("website"))
                if not domain:
                    f = finding_map.get(contact.get("finding_id") or "")
                    if f:
                        domain = _domain_from_url(f.get("source_url"))

                if not domain:
                    org = (contact.get("organization") or "").strip()
                    if org:
                        try:
                            domain = await self._domain_search(client, api_key, org)
                            lookups_done += 1
                            await asyncio.sleep(sleep_between)
                        except Exception as exc:  # noqa: BLE001
                            ctx.log("warning", f"domain-search failed for {org!r}: {exc}")

                if not domain:
                    not_found += 1
                    ctx.log("info", f"[{i}/{len(contacts)}] {name} — no domain to query, skip")
                    continue

                # Email Finder
                try:
                    result = await self._email_finder(client, api_key, domain, first, last)
                    lookups_done += 1
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    ctx.log("error", f"[{i}/{len(contacts)}] {name} — Hunter error: {exc}")
                    await asyncio.sleep(sleep_between)
                    continue

                update = self._build_update(result)
                if not update.get("email") and not update.get("linkedin_url") and not update.get("twitter_url"):
                    not_found += 1
                    ctx.log("info", f"[{i}/{len(contacts)}] {name} @ {domain} — no email or social found")
                    # Still mark as enriched so we don't keep retrying for `skip_days`.
                    update = {}

                update["enriched_at"] = datetime.now(timezone.utc).isoformat()
                update["enrichment_provider"] = "hunter"

                try:
                    sb.table("contacts").update(update).eq("id", contact["id"]).execute()
                    if update.get("email"):
                        found += 1
                        ctx.log(
                            "info",
                            f"[{i}/{len(contacts)}] {name} → {update['email']} "
                            f"(score={update.get('email_score')}, verify={update.get('email_verification_status')})",
                        )
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    ctx.log("error", f"DB write failed for {contact['id']}: {exc}")

                await asyncio.sleep(sleep_between)

        summary = (
            f"Hunter lookups: {lookups_done} calls → {found} emails found, "
            f"{not_found} not found, {errors} errors."
        )
        ctx.log("info", summary)
        return AgentResult(records_created=found, errors_count=errors, summary=summary)

    # ── Selection ─────────────────────────────────────────────────────
    def _select_contacts(
        self,
        sb,
        ctx: AgentContext,
        *,
        project_id: Optional[str],
        contact_ids: Optional[list[str]],
        skip_days: int,
        force_reenrich: bool,
    ) -> list[dict]:
        q = sb.table("contacts").select(
            "id, name, organization, website, email, finding_id, project_id, enriched_at"
        ).is_("email", "null")

        if contact_ids:
            q = q.in_("id", contact_ids)
        if project_id:
            q = q.eq("project_id", project_id)

        try:
            rows = q.limit(5000).execute().data or []
        except Exception as exc:  # noqa: BLE001
            ctx.log("error", f"Could not select contacts: {exc}")
            return []

        if force_reenrich or skip_days <= 0:
            return rows

        cutoff = datetime.now(timezone.utc) - timedelta(days=skip_days)
        keep: list[dict] = []
        skipped = 0
        for r in rows:
            ts = r.get("enriched_at")
            if ts:
                try:
                    when = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    if when > cutoff:
                        skipped += 1
                        continue
                except (TypeError, ValueError):
                    pass
            keep.append(r)
        if skipped:
            ctx.log("info", f"Skipped {skipped} contacts enriched within last {skip_days} days.")
        return keep

    # ── Hunter API calls ──────────────────────────────────────────────
    @staticmethod
    async def _domain_search(client: httpx.AsyncClient, api_key: str, company: str) -> Optional[str]:
        r = await client.get(
            f"{HUNTER_BASE}/domain-search",
            params={"company": company, "api_key": api_key, "limit": 1},
        )
        r.raise_for_status()
        body = r.json() or {}
        return ((body.get("data") or {}).get("domain")) or None

    @staticmethod
    async def _email_finder(
        client: httpx.AsyncClient, api_key: str, domain: str, first: str, last: str,
    ) -> dict:
        r = await client.get(
            f"{HUNTER_BASE}/email-finder",
            params={
                "domain": domain,
                "first_name": first,
                "last_name": last,
                "api_key": api_key,
            },
        )
        if r.status_code == 404:
            return {}
        r.raise_for_status()
        return ((r.json() or {}).get("data")) or {}

    # ── Mapping ───────────────────────────────────────────────────────
    @staticmethod
    def _build_update(data: dict) -> dict:
        if not data:
            return {}
        out: dict = {}
        if data.get("email"):
            out["email"] = data["email"]
        if data.get("score") is not None:
            try:
                out["email_score"] = int(data["score"])
            except (TypeError, ValueError):
                pass
        verification = data.get("verification") or {}
        vs = verification.get("status") or data.get("verification_status")
        if vs:
            out["email_verification_status"] = vs
        # linkedin / twitter / phone live at the top level of the response
        if data.get("linkedin_url"):
            out["linkedin_url"] = data["linkedin_url"]
        if data.get("twitter"):
            tw = data["twitter"]
            out["twitter_url"] = tw if tw.startswith("http") else f"https://twitter.com/{tw.lstrip('@')}"
        if data.get("phone_number"):
            out["phone"] = data["phone_number"]
        sources = data.get("sources") or []
        if sources:
            trimmed = [
                {
                    "url": s.get("uri"),
                    "extracted_on": s.get("extracted_on"),
                    "last_seen_on": s.get("last_seen_on"),
                }
                for s in sources[:10]
                if s.get("uri")
            ]
            if trimmed:
                out["enrichment_sources"] = trimmed
        return out
