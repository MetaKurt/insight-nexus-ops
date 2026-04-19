"""Client enrichment agent — extracts TEDx event organizers into `contacts`.

This is Stage 2 of the TEDx pipeline:

    Stage 1: tedx_scrape       → writes `findings` rows (one per TEDx event)
    Stage 2: client_enrichment → for each finding, visit the TED event page,
                                  pull every "Organizing team" person, then
                                  visit each person's TED profile to extract
                                  job title, organization, website, LinkedIn,
                                  Twitter, bio. Writes `contacts` rows.

Optionally also follows each organizer's company website link to look for a
contact page (sometimes yields `info@…` emails).

Per the v1 plan (2026-04-19):
- Email is NOT scraped from TED itself — TED hides it behind a login wall.
  We rely on website + LinkedIn for outreach. (A future Hunter.io agent
  can fill in emails.)
- We store BOTH LinkedIn and Twitter — the schema only has one
  `social_url` column, so LinkedIn wins; Twitter goes into `notes`.
- The agent is idempotent: re-running it UPDATEs existing rows
  (matched by finding_id + name) instead of duplicating.

Payload knobs (all optional):
- mission_id            uuid    (auto-injected by queue_mission_stage)
- mission_stage_id      uuid    (auto-injected)
- depends_on_stage_id   uuid    (auto-injected — used to find Stage-1 findings)
- projectId             uuid    attached to each contact row
- max_findings          int     cap on findings to enrich per run (default 200)
- max_contacts          int     hard cap on contacts inserted (default 1000)
- follow_company_links  bool    visit org websites for contact pages (default True)
- min_event_delay_ms    int     politeness delay between event pages (default 1500)
- min_profile_delay_ms  int     politeness delay between profile pages (default 1000)
"""

from __future__ import annotations

import asyncio
import re
from typing import List, Optional

from .base import AgentContext, AgentResult, BaseAgent
from ..config import settings


# Same invisible-character cleanup as tedx_scrape — TED inserts soft hyphens
# everywhere ("­T­E­Dx­Boca­Raton" instead of "TEDxBocaRaton").
_INVISIBLE_CHARS_RE = re.compile(r"[\u00AD\u200B\u200C\u200D\u2060\uFEFF]")
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


def clean_text(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = _INVISIBLE_CHARS_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


class ClientEnrichmentAgent(BaseAgent):
    job_type = "client_enrichment"

    AGENT_VERSION = "2026-04-19.v4-log-insert-errors"

    DEFAULT_MAX_FINDINGS = 200
    DEFAULT_MAX_CONTACTS = 1000
    DEFAULT_EVENT_DELAY_MS = 1500
    DEFAULT_PROFILE_DELAY_MS = 1000

    async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:
        import os as _os
        ctx.log(
            "info",
            f"client_enrichment agent v={self.AGENT_VERSION} "
            f"file={_os.path.abspath(__file__)}",
        )

        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            ctx.log("error", f"Playwright is not installed: {exc}")
            return AgentResult(0, 1, "Playwright missing — run `playwright install chromium`.")

        sb = ctx.supabase

        # ── Resolve payload knobs ──────────────────────────────────────
        project_id: Optional[str] = payload.get("projectId") or payload.get("project_id") or None
        depends_on_stage_id: Optional[str] = payload.get("depends_on_stage_id") or None
        mission_id: Optional[str] = payload.get("mission_id") or None

        try:
            max_findings = int(payload.get("max_findings") or self.DEFAULT_MAX_FINDINGS)
        except (TypeError, ValueError):
            max_findings = self.DEFAULT_MAX_FINDINGS
        max_findings = max(1, min(max_findings, 5000))

        try:
            max_contacts = int(payload.get("max_contacts") or self.DEFAULT_MAX_CONTACTS)
        except (TypeError, ValueError):
            max_contacts = self.DEFAULT_MAX_CONTACTS
        max_contacts = max(1, min(max_contacts, 10000))

        follow_company_links: bool = bool(payload.get("follow_company_links", True))
        event_delay = int(payload.get("min_event_delay_ms") or self.DEFAULT_EVENT_DELAY_MS) / 1000.0
        profile_delay = int(payload.get("min_profile_delay_ms") or self.DEFAULT_PROFILE_DELAY_MS) / 1000.0

        ctx.log(
            "info",
            f"Enrichment params — project_id={project_id} "
            f"depends_on_stage_id={depends_on_stage_id} max_findings={max_findings} "
            f"max_contacts={max_contacts} follow_company_links={follow_company_links}",
        )

        # ── Pick the findings to enrich ────────────────────────────────
        findings = self._select_findings(
            sb, ctx,
            depends_on_stage_id=depends_on_stage_id,
            project_id=project_id,
            max_findings=max_findings,
        )
        if not findings:
            ctx.log("warning", "No upstream findings to enrich. Nothing to do.")
            return AgentResult(0, 0, "No findings found for enrichment.")

        ctx.log("info", f"Selected {len(findings)} findings to enrich.")

        contacts_created = 0
        contacts_updated = 0
        errors = 0

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=settings.headless)
            try:
                context = await browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/127.0 Safari/537.36"
                    )
                )
                page = await context.new_page()

                for i, finding in enumerate(findings, start=1):
                    if contacts_created + contacts_updated >= max_contacts:
                        ctx.log("info", f"Hit max_contacts cap ({max_contacts}). Stopping.")
                        break

                    finding_id = finding["id"]
                    event_url = finding.get("source_url")
                    event_title = clean_text(finding.get("title")) or "(unknown event)"
                    if not event_url:
                        ctx.log("warning", f"Finding {finding_id} has no source_url, skipping.")
                        continue

                    try:
                        organizers = await self._extract_organizers_from_event(page, event_url)
                    except Exception as exc:  # noqa: BLE001
                        errors += 1
                        ctx.log("error", f"Failed to load event {event_url}: {exc}")
                        await asyncio.sleep(event_delay)
                        continue

                    if not organizers:
                        ctx.log("info", f"[{i}/{len(findings)}] {event_title} → 0 organizers")
                        await asyncio.sleep(event_delay)
                        continue

                    ctx.log(
                        "info",
                        f"[{i}/{len(findings)}] {event_title} → {len(organizers)} organizers",
                    )

                    for org in organizers:
                        if contacts_created + contacts_updated >= max_contacts:
                            break

                        # Enrich from profile page if we have one
                        profile = {}
                        if org.get("profile_url"):
                            try:
                                profile = await self._extract_profile(page, org["profile_url"])
                                await asyncio.sleep(profile_delay)
                            except Exception as exc:  # noqa: BLE001
                                errors += 1
                                ctx.log(
                                    "warning",
                                    f"Profile fetch failed for {org.get('name')}: {exc}",
                                )

                        # Optionally follow company website to look for emails
                        company_emails: List[str] = []
                        if follow_company_links and profile.get("website"):
                            try:
                                company_emails = await self._extract_emails_from_company(
                                    page, profile["website"]
                                )
                                await asyncio.sleep(profile_delay)
                            except Exception as exc:  # noqa: BLE001
                                ctx.log(
                                    "debug",
                                    f"Company page fetch failed for {profile.get('website')}: {exc}",
                                )

                        contact_row = self._build_contact_row(
                            finding=finding,
                            project_id=project_id,
                            organizer=org,
                            profile=profile,
                            company_emails=company_emails,
                        )

                        action = self._upsert_contact(sb, contact_row, ctx)
                        if action == "inserted":
                            contacts_created += 1
                        elif action == "updated":
                            contacts_updated += 1
                        elif action == "skipped":
                            errors += 1

                    await asyncio.sleep(event_delay)
            finally:
                await browser.close()

        summary = (
            f"Enriched {len(findings)} events → "
            f"{contacts_created} new contacts, {contacts_updated} updated, "
            f"{errors} errors. Mission={mission_id}"
        )
        ctx.log("info", summary)
        return AgentResult(
            records_created=contacts_created,
            errors_count=errors,
            summary=summary,
        )

    # ── Finding selection ─────────────────────────────────────────────
    def _select_findings(
        self,
        sb,
        ctx: AgentContext,
        *,
        depends_on_stage_id: Optional[str],
        project_id: Optional[str],
        max_findings: int,
    ) -> List[dict]:
        """Pick TEDx findings to enrich.

        Strategy:
        1. If depends_on_stage_id is given → look up that stage's job_id,
           find the matching `runs` row, then findings WHERE run_id=that.
        2. If that yields nothing → fall back to ALL tedx_events findings,
           optionally filtered by project_id.
        """
        if depends_on_stage_id:
            try:
                stage_q = sb.table("mission_stages").select("job_id").eq(
                    "id", depends_on_stage_id
                ).maybe_single().execute()
                upstream_job_id = (stage_q.data or {}).get("job_id")
            except Exception as exc:  # noqa: BLE001
                ctx.log("warning", f"Could not load upstream stage: {exc}")
                upstream_job_id = None

            if upstream_job_id:
                try:
                    runs_q = sb.table("runs").select("id").eq(
                        "job_id", upstream_job_id
                    ).execute()
                    run_ids = [r["id"] for r in (runs_q.data or [])]
                except Exception as exc:  # noqa: BLE001
                    ctx.log("warning", f"Could not load upstream runs: {exc}")
                    run_ids = []

                if run_ids:
                    try:
                        f_q = sb.table("findings").select("*").in_(
                            "run_id", run_ids
                        ).eq("source_type", "tedx_events").limit(max_findings).execute()
                        rows = f_q.data or []
                        if rows:
                            return rows
                    except Exception as exc:  # noqa: BLE001
                        ctx.log("warning", f"Could not load findings by run_id: {exc}")

        # Fallback — every tedx_events finding (optionally project-scoped).
        ctx.log("info", "Falling back to all tedx_events findings (no upstream link found).")
        q = sb.table("findings").select("*").eq("source_type", "tedx_events")
        if project_id:
            q = q.eq("project_id", project_id)
        q = q.order("created_at", desc=True).limit(max_findings)
        return q.execute().data or []

    # ── Page extraction ───────────────────────────────────────────────
    @staticmethod
    async def _extract_organizers_from_event(page, event_url: str) -> List[dict]:
        """From a TED /tedx/events/{id} page, pull every organizing-team card."""
        await page.goto(event_url, wait_until="domcontentloaded", timeout=45_000)
        await page.wait_for_timeout(500)

        organizers = await page.evaluate(
            """
            () => {
              const out = [];
              const seen = new Set();

              // The "Organizing team" heading lives in a left col-lg-3.
              // The cards live in a SIBLING col-lg-6 inside the SAME parent
              // .row. So walk up to the nearest `.row` and search there.
              const headings = Array.from(document.querySelectorAll('h2,h3,h4'));
              const orgHeading = headings.find(h =>
                /organizing team/i.test((h.innerText || '').trim())
              );
              if (!orgHeading) return out;

              // Walk up until we find a .row that contains MORE than just
              // the heading column (i.e. the row that also holds the cards).
              let container = orgHeading.parentElement;
              while (container && container !== document.body) {
                if (container.classList && container.classList.contains('row')) {
                  // Make sure this row has the organizer content too
                  if (container.querySelector('a[href*="/profiles/"]') ||
                      container.querySelector('ul.sl, .media')) {
                    break;
                  }
                }
                container = container.parentElement;
              }
              if (!container) container = orgHeading.closest('.section') || document.body;

              // ── Pattern A: lead organizer(s) with profile links ──
              // <div class='media'> <a href="/profiles/123/about">Name</a>
              //   <strong>City, Country</strong> <strong>Organizer</strong>
              const profileLinks = Array.from(
                container.querySelectorAll('a[href*="/profiles/"]')
              );
              profileLinks.forEach(a => {
                const href = a.getAttribute('href') || '';
                if (!href.includes('/profiles/')) return;
                const profileUrl = href.startsWith('http')
                  ? href
                  : 'https://www.ted.com' + href;
                const key = 'p:' + profileUrl;
                if (seen.has(key)) return;

                const name = (a.innerText || '').replace(/\\s+/g, ' ').trim();
                if (!name) return;
                seen.add(key);

                const card = a.closest('.media, div, li, section, article') || a.parentElement;
                let role = '';
                let location = '';
                if (card) {
                  const strongs = Array.from(card.querySelectorAll('strong, b'));
                  for (const s of strongs) {
                    const t = (s.innerText || '').trim();
                    if (!t) continue;
                    if (/,/.test(t) && t.length < 120 && !location) {
                      location = t;
                    } else if (
                      /^(organizer|co-?organizer|curator|speaker|coach|host|licensee|founder|director|producer)/i.test(t)
                      && !role
                    ) {
                      role = t;
                    }
                  }
                }
                let photo = '';
                const img = card ? card.querySelector('img') : null;
                if (img) photo = img.getAttribute('src') || '';

                out.push({ name, profile_url: profileUrl, role: role || 'Organizer', location, photo_url: photo });
              });

              // ── Pattern B: co-organizers WITHOUT profile links ──
              // <ul class='sl'> <li> <h6>Name</h6> <em>City, Country</em> </li>
              const coLists = Array.from(container.querySelectorAll('ul.sl, ul.row'));
              coLists.forEach(ul => {
                const items = Array.from(ul.querySelectorAll('li'));
                items.forEach(li => {
                  // Skip if this li contains a profile link (already captured above)
                  if (li.querySelector('a[href*="/profiles/"]')) return;
                  const h = li.querySelector('h6, h5, h4, strong');
                  if (!h) return;
                  const name = (h.innerText || '').replace(/\\s+/g, ' ').trim();
                  if (!name || name.length > 80) return;
                  const key = 'n:' + name.toLowerCase();
                  if (seen.has(key)) return;
                  seen.add(key);

                  const em = li.querySelector('em');
                  const location = em ? (em.innerText || '').trim() : '';

                  out.push({
                    name,
                    profile_url: '',
                    role: 'Co-organizer',
                    location,
                    photo_url: ''
                  });
                });
              });

              return out;
            }
            """
        )

        # Clean every text field server-side too (TED soft-hyphens names).
        cleaned = []
        for o in organizers or []:
            name = clean_text(o.get("name"))
            if not name:
                continue
            cleaned.append({
                "name": name,
                "profile_url": o.get("profile_url") or "",
                "role": clean_text(o.get("role")) or "Organizer",
                "location": clean_text(o.get("location")) or "",
                "photo_url": o.get("photo_url") or "",
            })
        return cleaned

    @staticmethod
    async def _extract_profile(page, profile_url: str) -> dict:
        """From a TED /profiles/{id}/about page, pull job + socials + bio."""
        await page.goto(profile_url, wait_until="domcontentloaded", timeout=45_000)
        await page.wait_for_timeout(400)

        data = await page.evaluate(
            """
            () => {
              const out = {
                job_title: '',
                organization: '',
                location_line: '',
                website: '',
                twitter: '',
                linkedin: '',
                bio: '',
              };

              // The "X at Y, City, State, Country" line tends to be the
              // first paragraph after the name heading.
              const paragraphs = Array.from(document.querySelectorAll('p, div'));
              for (const p of paragraphs.slice(0, 30)) {
                const t = (p.innerText || '').trim();
                // Pattern: "Creative Director / Principal at Meter Creative,
                // Jacksonville, FL, United States"
                const m = t.match(/^(.+?)\\s+at\\s+(.+?),\\s*([A-Za-z .,'-]+)$/);
                if (m && !out.job_title) {
                  out.job_title = m[1].trim();
                  out.organization = m[2].trim();
                  out.location_line = m[3].trim();
                  break;
                }
              }

              // Social/website links — TED renders them as a row of <a> tags.
              const allLinks = Array.from(document.querySelectorAll('a'));
              for (const a of allLinks) {
                const href = a.getAttribute('href') || '';
                const text = (a.innerText || '').trim().toLowerCase();
                if (!href) continue;

                if (/twitter\\.com|x\\.com/i.test(href) && !out.twitter) {
                  out.twitter = href;
                } else if (/linkedin\\.com/i.test(href) && !out.linkedin) {
                  out.linkedin = href;
                } else if (
                  /^https?:/i.test(href) &&
                  !/ted\\.com|tedcdn|tedx/i.test(href) &&
                  !out.website &&
                  text && text !== 'twitter' && text !== 'linked in' &&
                  !/follow|sign in|privacy/i.test(text)
                ) {
                  // First non-TED, non-social external link with a label
                  out.website = href;
                }
              }

              // Bio — the paragraph after the "Bio" heading.
              const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
              const bioH = headings.find(h => /^bio$/i.test((h.innerText || '').trim()));
              if (bioH) {
                let n = bioH.nextElementSibling;
                while (n && !n.innerText) n = n.nextElementSibling;
                if (n) out.bio = (n.innerText || '').trim().slice(0, 800);
              }

              return out;
            }
            """
        )

        # Server-side cleanup
        return {
            "job_title": clean_text(data.get("job_title")),
            "organization": clean_text(data.get("organization")),
            "location_line": clean_text(data.get("location_line")),
            "website": (data.get("website") or "").strip() or None,
            "twitter": (data.get("twitter") or "").strip() or None,
            "linkedin": (data.get("linkedin") or "").strip() or None,
            "bio": clean_text(data.get("bio")),
        }

    @staticmethod
    async def _extract_emails_from_company(page, website_url: str) -> List[str]:
        """Visit a company website and try to find email addresses.

        Best-effort only. We try the homepage and a /contact page if the
        homepage doesn't surface emails. Returns at most 3 unique emails.
        """
        emails: set = set()
        candidates = [website_url]
        if "/contact" not in website_url.lower():
            base = website_url.rstrip("/")
            candidates.append(f"{base}/contact")

        for url in candidates:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
                await page.wait_for_timeout(300)
                html = await page.content()
                for m in _EMAIL_RE.findall(html or ""):
                    # Skip obvious junk
                    low = m.lower()
                    if any(bad in low for bad in ("example.com", "yourdomain", "@sentry", "wixpress", ".png", ".jpg")):
                        continue
                    emails.add(low)
                    if len(emails) >= 3:
                        return list(emails)
            except Exception:  # noqa: BLE001
                continue
        return list(emails)

    # ── Contact assembly + upsert ─────────────────────────────────────
    @staticmethod
    def _build_contact_row(
        *,
        finding: dict,
        project_id: Optional[str],
        organizer: dict,
        profile: dict,
        company_emails: List[str],
    ) -> dict:
        # Combine TED role + job title for clarity:
        # role_title = "Organizer · Creative Director / Principal"
        ted_role = organizer.get("role") or "Organizer"
        job_title = profile.get("job_title")
        combined_role = f"{ted_role} · {job_title}" if job_title else ted_role

        # social_url: prefer LinkedIn, fall back to Twitter, then profile URL.
        social_url = (
            profile.get("linkedin")
            or profile.get("twitter")
            or organizer.get("profile_url")
            or None
        )

        notes_parts = []
        event_title = clean_text(finding.get("title")) or "(unknown event)"
        notes_parts.append(f"TEDx event: {event_title}")
        if profile.get("twitter") and profile.get("linkedin"):
            notes_parts.append(f"Twitter: {profile['twitter']}")
        if profile.get("location_line"):
            notes_parts.append(f"Location: {profile['location_line']}")
        elif organizer.get("location"):
            notes_parts.append(f"Location: {organizer['location']}")
        if company_emails:
            notes_parts.append(f"Company emails: {', '.join(company_emails)}")
        if profile.get("bio"):
            notes_parts.append(f"Bio: {profile['bio']}")

        # Use first company email if found
        email = company_emails[0] if company_emails else None

        return {
            "finding_id": finding["id"],
            "project_id": project_id,
            "name": organizer["name"][:200],
            "organization": (profile.get("organization") or "")[:200] or None,
            "role_title": combined_role[:200],
            "email": email,
            "website": (profile.get("website") or "")[:500] or None,
            "social_url": (social_url or "")[:500] or None,
            "source": "ted_profile",
            "confidence": 0.9,
            "outreach_status": "not_contacted",
            "notes": " | ".join(notes_parts)[:2000],
        }

    @staticmethod
    def _upsert_contact(sb, row: dict, ctx=None) -> str:
        """Insert if (finding_id, name) doesn't exist; else update.

        Returns 'inserted', 'updated', or 'skipped'. Logs errors via ctx
        so we can see why writes are failing instead of silently dropping.
        """
        def _log(level: str, msg: str) -> None:
            if ctx is not None:
                try:
                    ctx.log(level, msg)
                except Exception:  # noqa: BLE001
                    pass

        try:
            existing = sb.table("contacts").select("id").eq(
                "finding_id", row["finding_id"]
            ).eq("name", row["name"]).limit(1).execute()
            existing_rows = existing.data or []
        except Exception as exc:  # noqa: BLE001
            _log("warning", f"contacts SELECT failed for {row.get('name')}: {exc}")
            existing_rows = []

        if existing_rows:
            contact_id = existing_rows[0]["id"]
            update_payload = {k: v for k, v in row.items() if k not in ("finding_id",)}
            try:
                sb.table("contacts").update(update_payload).eq("id", contact_id).execute()
                return "updated"
            except Exception as exc:  # noqa: BLE001
                _log("error", f"contacts UPDATE failed for {row.get('name')}: {exc}")
                return "skipped"

        try:
            sb.table("contacts").insert(row).execute()
            return "inserted"
        except Exception as exc:  # noqa: BLE001
            _log(
                "error",
                f"contacts INSERT failed for {row.get('name')!r} "
                f"(finding={row.get('finding_id')}): {exc}",
            )
            return "skipped"
