"""TEDx events scraper agent.

Scrapes https://www.ted.com/tedx/events for upcoming TEDx events.

Strategy (rewritten 2026-04-19):
- Push filters into the URL itself using TED's own query params:
    available=on              -> only "spaces available" events
    country=United+States     -> only US events
    year[]=2026 & year[]=2027 -> only the years we care about
  This dramatically narrows the result set BEFORE we parse the page,
  so we go from "scan 200 pages of global junk" to "scan ~5 pages of
  the exact rows we want".
- The actual page renders results as a `<table id="tedx-events-by-date">`
  with one `<tr class="tedx-events-table__event">` per event. The cells
  are: Date | Event name + link | Location | Space available (icon)
  | Webcast (icon).
- "Space available" is signalled by the icon `abbr.tedx-events-icon--yes`
  (with `title="Space available"` and screen-reader text "Yes"), NOT by
  any literal "spaces available" text in the row.
- Past events are pre-tagged by TED as `tedx-events-table__event--past`
  and we skip them.

Payload knobs (all optional):
- country         str           default "United States"
- years           int[]         default [2026, 2027]
- available_only  bool          default True
- max_pages       int           default 25
- limit           int           hard cap on findings, default 500
- keywords        str           comma-separated tokens to fuzzy-match name
- location        str           legacy state filter (e.g. "California")
- projectId       uuid          attached to each finding row

Each row written to the `findings` table:
- title       = event name
- summary     = "<type> · <city>, <state> · <date>"
- source_url  = TED listing URL (canonical, no query string)
- source_type = "tedx_events"
- data        = full structured JSON object
- project_id  = payload.projectId (or NULL)
- confidence  = 0.95
"""

from __future__ import annotations

import asyncio
import re
from typing import Iterable, List, Optional
from urllib.parse import urlencode

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

# Invisible characters TED inserts into event names for line-breaking.
# Soft hyphen (U+00AD), zero-width space (U+200B), zero-width non-joiner (U+200C),
# zero-width joiner (U+200D), word joiner (U+2060), BOM (U+FEFF).
_INVISIBLE_CHARS_RE = re.compile(r"[\u00AD\u200B\u200C\u200D\u2060\uFEFF]")


def clean_text(s: Optional[str]) -> Optional[str]:
    """Strip invisible/zero-width chars and collapse whitespace."""
    if s is None:
        return None
    s = _INVISIBLE_CHARS_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def detect_event_type(name: str) -> str:
    m = EVENT_TYPE_PATTERN.search(name or "")
    return m.group(1) if m else "TEDx"


def split_city_state(location: str) -> tuple[Optional[str], Optional[str]]:
    """Parse TED location strings.

    TED's table renders location across <br> tags which page.innerText turns
    into '\\n'-separated strings, but flattening (innerText quirks, no spaces
    around <br>) sometimes produces glued text like 'JacksonvilleUnited States'
    or 'Boca RatonFlorida'. This parser handles both.
    """
    if not location:
        return None, None

    normalized = clean_text(location.replace("\r", "\n")) or ""
    # First, try clean newline/comma split.
    parts = [p.strip() for p in re.split(r"[\n,]+", normalized) if p.strip()]

    # If we ended up with a single part, try to peel off a trailing country.
    if len(parts) == 1:
        single = parts[0]
        for country in ("United States", "USA", "Canada", "United Kingdom"):
            if single.lower().endswith(country.lower()) and len(single) > len(country):
                head = single[: -len(country)].strip(" ,")
                if head:
                    parts = [head, country]
                    break
        # Try peeling off a trailing US state name glued to the city.
        if len(parts) == 1:
            for state_name in US_STATES.keys():
                if single.lower().endswith(state_name) and len(single) > len(state_name):
                    head = single[: -len(state_name)].strip(" ,")
                    # Heuristic: head should look like a city (starts uppercase).
                    if head and head[0].isupper():
                        parts = [head, state_name.title()]
                        break

    if not parts:
        return None, None

    if parts[-1].lower() in {"united states", "usa", "us"}:
        parts = parts[:-1]
    if not parts:
        return None, None
    if len(parts) == 1:
        return parts[0], None

    city = ", ".join(parts[:-1])
    state = parts[-1]
    return city, state


def normalize_state(state: Optional[str]) -> Optional[str]:
    if not state:
        return None
    s = state.strip()
    if s.upper() in US_STATE_CODES:
        return s.upper()
    return US_STATES.get(s.lower(), s)


def is_us_state(state: Optional[str]) -> bool:
    if not state:
        return False
    s = state.strip()
    return s.upper() in US_STATE_CODES or s.lower() in US_STATES


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

    BASE_URL = "https://www.ted.com/tedx/events"
    DEFAULT_LIMIT = 500
    DEFAULT_MAX_PAGES = 25
    DEFAULT_COUNTRY = "United States"
    DEFAULT_YEARS = [2026, 2027]
    # Bump this whenever the agent logic changes so logs make it obvious
    # which version is actually executing on the worker machine.
    AGENT_VERSION = "2026-04-19.v6-clean-strings"

    async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:
        # Print the file path + version FIRST so we can always tell which
        # copy of the code is running (helps catch stale deploys).
        import os as _os
        ctx.log(
            "info",
            f"tedx_scrape agent v={self.AGENT_VERSION} "
            f"file={_os.path.abspath(__file__)}",
        )
        # Local imports so the rest of the worker boots even if Playwright
        # isn't installed (e.g. during initial setup / CI).
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            ctx.log("error", f"Playwright is not installed: {exc}")
            return AgentResult(0, 1, "Playwright missing — run `playwright install chromium`.")

        # ── Resolve payload knobs ──────────────────────────────────────
        country: Optional[str] = (payload.get("country") or self.DEFAULT_COUNTRY).strip() or None
        years_raw = payload.get("years") or self.DEFAULT_YEARS
        try:
            years: List[int] = [int(y) for y in years_raw if str(y).strip()]
        except (TypeError, ValueError):
            years = list(self.DEFAULT_YEARS)
        if not years:
            years = list(self.DEFAULT_YEARS)

        available_only: bool = bool(payload.get("available_only", True))
        keywords: Optional[str] = payload.get("keywords") or None
        legacy_state_filter: Optional[str] = (payload.get("location") or "").strip() or None

        try:
            max_pages = int(payload.get("max_pages") or self.DEFAULT_MAX_PAGES)
        except (TypeError, ValueError):
            max_pages = self.DEFAULT_MAX_PAGES
        max_pages = max(1, min(max_pages, 100))

        try:
            limit = int(payload.get("limit") or self.DEFAULT_LIMIT)
        except (TypeError, ValueError):
            limit = self.DEFAULT_LIMIT
        limit = max(1, min(limit, 5000))

        ctx.log(
            "info",
            f"TEDx scrape — country={country!r} years={years} "
            f"available_only={available_only} max_pages={max_pages} limit={limit} "
            f"keywords={keywords!r} state_filter={legacy_state_filter!r}",
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

                location_query = legacy_state_filter or country

                for target_year in years:
                    ctx.log("info", f"Scanning TED listing for year={target_year} location_query={location_query!r}")
                    for page_num in range(1, max_pages + 1):
                        if len(findings_to_insert) >= limit:
                            ctx.log("info", f"Hit user-specified limit ({limit}). Stopping.")
                            break

                        url = self._build_url(
                            location_query=location_query,
                            year=target_year,
                            available_only=available_only,
                            page=page_num,
                        )
                        ctx.log("info", f"Scanning page {page_num} → {url}")
                        try:
                            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                            await page.wait_for_timeout(500)
                        except Exception as exc:  # noqa: BLE001
                            errors += 1
                            ctx.log("warning", f"Page {page_num} failed to load: {exc}")
                            continue

                        rows = await self._extract_rows_from_page(page)
                        pages_scanned += 1

                        if not rows:
                            ctx.log(
                                "info",
                                f"Page {page_num} has no event rows — assuming end of listings for {target_year}.",
                            )
                            break

                        page_kept = 0
                        page_skipped_past = 0
                        page_skipped_no_space = 0
                        page_skipped_year = 0
                        page_skipped_country = 0
                        page_skipped_dup = 0
                        page_skipped_keyword = 0
                        page_skipped_state = 0
                        page_skipped_no_url = 0

                        for row in rows:
                            if len(findings_to_insert) >= limit:
                                break

                            listing_url = row.get("url") or ""
                            if not listing_url:
                                page_skipped_no_url += 1
                                continue
                            if listing_url in seen_urls:
                                page_skipped_dup += 1
                                continue
                            seen_urls.add(listing_url)

                            if row.get("is_past"):
                                page_skipped_past += 1
                                continue

                            spaces_available = bool(row.get("spaces_available"))
                            if available_only and not spaces_available:
                                page_skipped_no_space += 1
                                continue

                            name = (row.get("name") or "").strip()
                            location = (row.get("location") or "").strip()
                            date_text = (row.get("date_text") or "").strip()

                            city, state_raw = split_city_state(location)
                            if country and country.lower() in {"united states", "usa", "us"}:
                                if state_raw and not is_us_state(state_raw):
                                    page_skipped_country += 1
                                    continue
                            state = normalize_state(state_raw) if is_us_state(state_raw) else state_raw

                            year = extract_year(date_text, name)
                            if years and year and year not in years:
                                page_skipped_year += 1
                                continue

                            if not keyword_match(name, keywords):
                                page_skipped_keyword += 1
                                continue

                            if legacy_state_filter and not location_query:
                                t = legacy_state_filter.lower()
                                if t not in (state or "").lower() and t not in (city or "").lower():
                                    page_skipped_state += 1
                                    continue

                            event_type = detect_event_type(name)
                            start_date, end_date = self._parse_dates(date_text, year or target_year)

                            record = {
                                "event_name": name,
                                "event_type": event_type,
                                "start_date": start_date,
                                "end_date": end_date,
                                "city": city,
                                "state": state,
                                "country": country,
                                "spaces_available": spaces_available,
                                "webcast": bool(row.get("webcast")),
                                "ted_url": listing_url,
                                "raw_date_text": date_text,
                                "raw_location": location,
                            }
                            findings_to_insert.append(self._to_finding_row(record, payload))
                            page_kept += 1

                        ctx.log(
                            "info",
                            f"Page {page_num}: {len(rows)} rows | kept {page_kept} | "
                            f"skipped past={page_skipped_past} no_space={page_skipped_no_space} "
                            f"year={page_skipped_year} country={page_skipped_country} "
                            f"dup={page_skipped_dup} keyword={page_skipped_keyword} "
                            f"state={page_skipped_state} no_url={page_skipped_no_url} "
                            f"(running total {len(findings_to_insert)})",
                        )

                        await page.wait_for_timeout(300)

                    if len(findings_to_insert) >= limit:
                        break

                await context.close()
            finally:
                await browser.close()

        ctx.log(
            "info",
            f"Scrape complete — {pages_scanned} pages scanned, "
            f"{len(findings_to_insert)} matching events.",
        )

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

        years_label = "/".join(str(y) for y in years) if years else "any year"
        country_label = country or "any country"
        summary = (
            f"Found {inserted} TEDx events in {country_label} for {years_label}"
            f"{' with spaces available' if available_only else ''} "
            f"(scanned {pages_scanned} listing pages)."
        )
        return AgentResult(
            records_created=inserted,
            errors_count=errors,
            summary=summary,
        )

    # ── Helpers ────────────────────────────────────────────────────────

    def _build_url(
        self,
        *,
        location_query: Optional[str],
        year: int,
        available_only: bool,
        page: int,
    ) -> str:
        """Construct the listing URL using TED's real server-side filters.

        TED's filter form uses:
        - autocomplete_filter=<location, name, or type>
        - year=<single year>
        - available=on
        """
        params: list[tuple[str, str]] = []
        if available_only:
            params.append(("available", "on"))
        if location_query:
            params.append(("autocomplete_filter", location_query))
        params.append(("year", str(year)))
        params.append(("sort", "newest"))
        params.append(("page", str(page)))
        return f"{self.BASE_URL}?{urlencode(params)}"

    @staticmethod
    async def _extract_rows_from_page(page) -> List[dict]:
        """Pull structured event data from `<table id="tedx-events-by-date">`.

        Each `<tr.tedx-events-table__event>` has cells in this order:
          [0] Date (with anchor and time element)
          [1] Event name (with anchor to the event page)
          [2] Location ("City, State, Country" or "City, State")
          [3] Space available (contains <abbr title="Space available"> if yes)
          [4] Webcast (similar abbr)

        We also skip rows tagged `tedx-events-table__event--past`.
        """
        return await page.evaluate(
            r"""
            () => {
              const out = [];
              const rows = document.querySelectorAll(
                'tr.tedx-events-table__event, table#tedx-events-by-date tr'
              );
              const seen = new Set();

              rows.forEach((tr) => {
                // Find the event link in this row — that's our anchor.
                const link = tr.querySelector('a[href*="/tedx/events/"]');
                if (!link) return;
                const href = link.getAttribute('href') || '';
                const m = href.match(/\/tedx\/events\/(\d+)/);
                if (!m) return;
                const url = 'https://www.ted.com' + href.split('?')[0].split('#')[0];
                if (seen.has(url)) return;
                seen.add(url);

                const cls = tr.className || '';
                const is_past = /tedx-events-table__event--past|--past\b/.test(cls);

                const cells = tr.querySelectorAll('td');
                const cellText = (i) => (cells[i] ? (cells[i].innerText || '').trim() : '');

                // Some rows have a leading "today/tomorrow" label cell, so we
                // identify cells by content rather than strict index when needed.
                let dateText = cellText(0);
                let nameText = (link.innerText || '').trim();
                let locationText = '';

                const cleanCellValue = (cell) => {
                  const clone = cell.cloneNode(true);
                  clone.querySelectorAll('.table__label').forEach((n) => n.remove());
                  return (clone.innerText || '').trim();
                };

                cells.forEach((c, idx) => {
                  const label = (c.querySelector('.table__label')?.innerText || '').trim().toLowerCase();
                  const value = cleanCellValue(c);
                  if (!value) return;

                  if (label.startsWith('date')) {
                    dateText = value;
                    return;
                  }
                  if (label.startsWith('location')) {
                    locationText = value;
                    return;
                  }

                  if (!locationText && idx !== 0 && !c.querySelector('a[href*="/tedx/events/"]')) {
                    const monthRe = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
                    if (!monthRe.test(value) && value.length < 120) {
                      locationText = value;
                    }
                  }
                });

                // Identify space/webcast cells by looking for the abbr icons.
                const abbrs = tr.querySelectorAll('abbr');
                let spaces_available = false;
                let webcast = false;
                abbrs.forEach((ab) => {
                  const title = (ab.getAttribute('title') || '').toLowerCase();
                  const cls = (ab.className || '').toLowerCase();
                  const isYes = /--yes\b/.test(cls) || /yes/.test((ab.innerText || '').toLowerCase());
                  if (title.includes('space') && isYes) spaces_available = true;
                  if (title.includes('webcast') && isYes) webcast = true;
                });

                // Fallback: explicit class on the cell.
                if (!spaces_available) {
                  spaces_available = !!tr.querySelector(
                    '.tedx-events-icon--yes, [class*="space"][class*="yes"]'
                  ) && /space/i.test(tr.innerText || '');
                }

                out.push({
                  url,
                  name: nameText,
                  date_text: dateText,
                  location: locationText,
                  spaces_available,
                  webcast,
                  is_past,
                });
              });

              return out;
            }
            """
        )

    @staticmethod
    def _parse_dates(date_text: str, year: int) -> tuple[Optional[str], Optional[str]]:
        """Best-effort parse of strings like 'October 17, 2026' or
        'October 17 - 18, 2026'. Returns ISO date strings or None."""
        if not date_text:
            return None, None
        try:
            from dateutil import parser as dateparser
        except ImportError:
            return None, None

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

        try:
            start = dateparser.parse(date_text, fuzzy=True).date().isoformat()
            return start, None
        except Exception:  # noqa: BLE001
            return None, None

    @staticmethod
    def _to_finding_row(record: dict, payload: dict) -> dict:
        title = record["event_name"] or "TEDx event"
        date_part = record.get("start_date") or record.get("raw_date_text") or "TBD"
        loc_part = ", ".join(filter(None, [record.get("city"), record.get("state")])) or record.get("raw_location") or ""
        summary = f"{record['event_type']} · {loc_part} · {date_part}"
        return {
            "title": title[:300],
            "summary": summary[:600],
            "source_url": record["ted_url"],
            "source_type": "tedx_events",
            "status": "new",
            "data": record,
            "project_id": payload.get("projectId") or None,
            "confidence": 0.95,
        }

    @staticmethod
    def _chunks(items: List[dict], size: int) -> Iterable[List[dict]]:
        for i in range(0, len(items), size):
            yield items[i : i + size]
