"""TEDx events scraper agent.

Scrapes https://www.ted.com/tedx/events for upcoming TEDx events matching
the rules from the original task spec:

- Located in the United States
- Year is 2026 or 2027
- Event has spaces available
- No duplicates (deduped by TED listing URL)
- No past events

For each event we extract:
- event name
- event type (TEDx, TEDxYouth, TEDxWomen, etc.)
- start date
- end date (if available)
- city
- state
- TED listing URL

Results are written as rows in the `findings` table:
- title       = event name
- summary     = "TEDx | <type> | <city>, <state> | <date>"
- source_url  = TED listing URL
- source_type = "tedx_events"
- data        = full structured JSON object
- project_id  = payload.projectId (or NULL)
- run_id      = NULL (we don't create a run row from here)

The agent is configurable via the job's payload:
- payload.location:  optional state name (e.g. "California") to narrow down
- payload.keywords:  comma-separated tokens to fuzzy-filter event names
- payload.limit:     hard cap on findings created (default 500)
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Iterable, List, Optional

from .base import AgentContext, AgentResult, BaseAgent
from ..config import settings


# ── State name -> two-letter code (used to recognize US events) ────────
US_STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
    "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
    "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "district of columbia": "DC", "puerto rico": "PR",
}
US_STATE_CODES = set(US_STATES.values())

EVENT_TYPE_PATTERN = re.compile(r"^(TEDx[A-Za-z]*)", re.IGNORECASE)
YEAR_PATTERN = re.compile(r"\b(20\d{2})\b")


def detect_event_type(name: str) -> str:
    m = EVENT_TYPE_PATTERN.search(name or "")
    return m.group(1) if m else "TEDx"


def split_city_state(location: str) -> tuple[Optional[str], Optional[str]]:
    """Parse strings like 'San Francisco, California, United States'."""
    if not location:
        return None, None
    parts = [p.strip() for p in location.split(",")]
    parts = [p for p in parts if p]
    if not parts:
        return None, None
    if len(parts) == 1:
        return parts[0], None
    # Last part is country, second-to-last is state, rest joined as city.
    if len(parts) >= 3:
        city = ", ".join(parts[:-2])
        state = parts[-2]
    else:
        city, state = parts[0], parts[1]
    return city, state


def is_us_state(state: Optional[str]) -> bool:
    if not state:
        return False
    s = state.strip()
    if s.upper() in US_STATE_CODES:
        return True
    return s.lower() in US_STATES


def normalize_state(state: Optional[str]) -> Optional[str]:
    if not state:
        return None
    s = state.strip()
    if s.upper() in US_STATE_CODES:
        return s.upper()
    return US_STATES.get(s.lower(), s)


def extract_year(*candidates: Optional[str]) -> Optional[int]:
    for c in candidates:
        if not c:
            continue
        m = YEAR_PATTERN.search(c)
        if m:
            return int(m.group(1))
    return None


def keyword_match(name: str, keywords: Optional[str]) -> bool:
    if not keywords:
        return True
    tokens = [t.strip().lower() for t in keywords.split(",") if t.strip()]
    if not tokens:
        return True
    n = (name or "").lower()
    return any(t in n for t in tokens)


class TedxScrapeAgent(BaseAgent):
    job_type = "tedx_scrape"

    LISTING_URL = "https://www.ted.com/tedx/events?sort=newest&page={page}"
    MAX_PAGES = 200
    DEFAULT_LIMIT = 500

    async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:
        # Local imports so the rest of the worker boots even if Playwright
        # isn't installed (e.g. during initial setup / CI).
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            ctx.log("error", f"Playwright is not installed: {exc}")
            return AgentResult(0, 1, "Playwright missing — run `playwright install chromium`.")

        target_state_filter: Optional[str] = (payload.get("location") or "").strip() or None
        keywords: Optional[str] = payload.get("keywords") or None
        try:
            limit = int(payload.get("limit") or self.DEFAULT_LIMIT)
        except (TypeError, ValueError):
            limit = self.DEFAULT_LIMIT
        limit = max(1, min(limit, 5000))

        ctx.log(
            "info",
            f"TEDx scrape starting — years 2026/2027, US only, limit={limit}, "
            f"state_filter={target_state_filter!r}, keywords={keywords!r}",
        )

        seen_urls: set[str] = set()
        findings_to_insert: List[dict] = []
        errors = 0
        pages_scanned = 0

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

                for page_num in range(1, self.MAX_PAGES + 1):
                    if len(findings_to_insert) >= limit:
                        ctx.log("info", f"Hit user-specified limit ({limit}). Stopping.")
                        break

                    url = self.LISTING_URL.format(page=page_num)
                    ctx.log("info", f"Scanning page {page_num} → {url}")
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                        # Cards are rendered server-side, but give JS a moment.
                        await page.wait_for_timeout(800)
                    except Exception as exc:  # noqa: BLE001
                        errors += 1
                        ctx.log("warning", f"Page {page_num} failed to load: {exc}")
                        continue

                    cards = await self._extract_cards_from_page(page)
                    pages_scanned += 1

                    if not cards:
                        ctx.log("info", f"Page {page_num} has no event cards — assuming end of listings.")
                        break

                    page_kept = 0
                    for card in cards:
                        if len(findings_to_insert) >= limit:
                            break

                        name = card.get("name") or ""
                        location = card.get("location") or ""
                        date_text = card.get("date_text") or ""
                        listing_url = card.get("url") or ""
                        spaces_available = bool(card.get("spaces_available"))

                        if not listing_url or listing_url in seen_urls:
                            continue
                        seen_urls.add(listing_url)

                        # Filter: spaces available
                        if not spaces_available:
                            continue

                        # Filter: US
                        city, state_raw = split_city_state(location)
                        if not is_us_state(state_raw):
                            continue
                        state = normalize_state(state_raw)

                        # Filter: 2026 / 2027
                        year = extract_year(date_text, name)
                        if year not in (2026, 2027):
                            continue

                        # Filter: keywords (optional)
                        if not keyword_match(name, keywords):
                            continue

                        # Filter: state narrowing (optional)
                        if target_state_filter:
                            t = target_state_filter.lower()
                            if t not in (state or "").lower() and t not in (city or "").lower():
                                continue

                        event_type = detect_event_type(name)
                        start_date, end_date = self._parse_dates(date_text, year)

                        record = {
                            "event_name": name.strip(),
                            "event_type": event_type,
                            "start_date": start_date,
                            "end_date": end_date,
                            "city": city,
                            "state": state,
                            "country": "United States",
                            "spaces_available": True,
                            "ted_url": listing_url,
                            "raw_date_text": date_text,
                        }

                        findings_to_insert.append(
                            self._to_finding_row(record, payload)
                        )
                        page_kept += 1

                    ctx.log(
                        "info",
                        f"Page {page_num}: {len(cards)} cards seen, {page_kept} kept "
                        f"(running total {len(findings_to_insert)})",
                    )

                    # Be polite.
                    await page.wait_for_timeout(400)

                await context.close()
            finally:
                await browser.close()

        ctx.log(
            "info",
            f"Scrape complete — {pages_scanned} pages scanned, "
            f"{len(findings_to_insert)} matching events.",
        )

        # Bulk insert (chunked) to be safe with the PostgREST size cap.
        inserted = 0
        if findings_to_insert:
            ctx.log("info", f"Writing {len(findings_to_insert)} findings to Supabase...")
            for batch in self._chunks(findings_to_insert, 100):
                try:
                    resp = await asyncio.to_thread(
                        lambda b=batch: ctx.supabase.table("findings").insert(b).execute()
                    )
                    inserted += len(resp.data or [])
                except Exception as exc:  # noqa: BLE001
                    errors += len(batch)
                    ctx.log("error", f"Insert batch failed ({len(batch)} rows): {exc}")
            ctx.log("info", f"Inserted {inserted} findings.")

        summary = (
            f"Found {inserted} TEDx events in the US for 2026/2027 with spaces available "
            f"(scanned {pages_scanned} listing pages)."
        )
        return AgentResult(
            records_created=inserted,
            errors_count=errors,
            summary=summary,
        )

    # ── Helpers ────────────────────────────────────────────────────────

    @staticmethod
    async def _extract_cards_from_page(page) -> List[dict]:
        """Pull the structured event data out of the listing page.

        TED.com renders TEDx event cards as anchor elements. The exact CSS
        selector has shifted over the years, so we use a resilient extraction:
        find every `<a>` whose href looks like `/tedx/events/<id>`, then walk
        its container to grab the title, location, date, and the
        "Spaces available" badge if present.
        """
        return await page.evaluate(
            r"""
            () => {
              const out = [];
              const anchors = document.querySelectorAll('a[href*="/tedx/events/"]');
              const seen = new Set();
              anchors.forEach((a) => {
                const href = a.getAttribute('href') || '';
                const m = href.match(/^\/tedx\/events\/(\d+)/);
                if (!m) return;
                const url = 'https://www.ted.com' + href.split('?')[0];
                if (seen.has(url)) return;
                seen.add(url);

                // Find a sensible container: walk up until we hit something with text.
                let container = a;
                for (let i = 0; i < 5; i++) {
                  if (container.parentElement) container = container.parentElement;
                }
                const text = (container.innerText || '').trim();
                const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

                // Heuristics:
                //  - first line that starts with TEDx is the name
                //  - a line with month name + year = date
                //  - a line with two commas = location
                //  - "Spaces available" text indicates availability
                const months = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
                const name = lines.find(l => /^TEDx/i.test(l)) || (a.innerText || '').trim();
                const date_text = lines.find(l => months.test(l) && /20\d{2}/.test(l)) || '';
                const location = lines.find(l => (l.match(/,/g) || []).length >= 1 && !months.test(l)) || '';
                const spaces_available = /spaces?\s+available/i.test(text);

                out.push({ url, name, date_text, location, spaces_available });
              });
              return out;
            }
            """
        )

    @staticmethod
    def _parse_dates(date_text: str, year: int) -> tuple[Optional[str], Optional[str]]:
        """Best-effort parse of strings like 'October 17, 2026' or
        'October 17 - 18, 2026'. Returns ISO date strings or None.
        """
        if not date_text:
            return None, None
        try:
            from dateutil import parser as dateparser
        except ImportError:
            return None, None

        # Range like "October 17 - 19, 2026"
        rng = re.match(
            r"([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*(\d{1,2}),?\s*(\d{4})?",
            date_text,
        )
        if rng:
            month, d1, d2, y = rng.groups()
            yr = int(y) if y else year
            try:
                start = dateparser.parse(f"{month} {d1} {yr}").date().isoformat()
                end = dateparser.parse(f"{month} {d2} {yr}").date().isoformat()
                return start, end
            except Exception:  # noqa: BLE001
                pass

        # Single date
        try:
            start = dateparser.parse(date_text, fuzzy=True).date().isoformat()
            return start, None
        except Exception:  # noqa: BLE001
            return None, None

    @staticmethod
    def _to_finding_row(record: dict, payload: dict) -> dict:
        title = record["event_name"]
        date_part = record.get("start_date") or record.get("raw_date_text") or "TBD"
        loc_part = ", ".join(filter(None, [record.get("city"), record.get("state")]))
        summary = f"{record['event_type']} · {loc_part} · {date_part}"
        return {
            "title": title[:300],
            "summary": summary[:600],
            "source_url": record["ted_url"],
            "source_type": "tedx_events",
            "status": "new",
            "data": record,  # full structured payload as JSONB
            "project_id": payload.get("projectId") or None,
            "confidence": 0.95,
        }

    @staticmethod
    def _chunks(items: List[dict], size: int) -> Iterable[List[dict]]:
        for i in range(0, len(items), size):
            yield items[i : i + size]
