

## Answering both questions

### 1. "Should I click Approve & continue?"

**Short answer: not yet.** Here's why:

- Approve will mark Stage 1 done and auto-queue Stage 2 (`Enrich Organizer Contacts`, job type `client_enrichment`).
- I checked the worker — only two agents exist on disk: `hello` and `tedx_scrape`. There is **no `client_enrichment` agent**. So Stage 2 will queue, no worker will claim it, and it'll sit pending forever.
- You can still click Approve later — it does nothing destructive — but right now it'll just create a stuck job.

### 2. "Where are the scrapes it just pulled back?"

**They're in the database (20 rows in `findings`), but the Records page can't show them.** Two reasons:

- `src/pages/Records.tsx` reads from mock data, not Supabase (`api.findings.list` returns hardcoded fixtures, same pattern as Contacts/Sources/Errors — only Control Center is wired up).
- Even when wired, the source-type filter doesn't include `tedx_events`, so the rows would be filtered out.

I also spotted two data-quality bugs in the rows we just inserted:
- **Title has invisible soft-hyphens**: stored as `­T­E­Dx­Boca­Raton` (U+00AD chars between every letter — TED puts them there for line-breaking; we should strip them).
- **City field is concatenated**: stored as `"JacksonvilleUnited States"` — the parser glued city + country without separation, and `state` is null.

## Plan — three small fixes, in priority order

**Step 1 — Wire the Records page to real Supabase findings** (so you can see what the scraper produced)
- Replace the mock `api.findings.list` call with a real Supabase query against the `findings` table.
- Add `tedx_events` to the source-type filter dropdown.
- Map the DB columns (`source_url`, `source_type`, `data` jsonb) to the existing `Finding` UI shape; show city/state from `data` jsonb in the table.
- Update `RecordDetail.tsx` similarly so you can click into a row.

**Step 2 — Fix the two scraper data bugs** (in `worker/tedx_scrape.py`, requires a `git pull` + worker restart on Ubuntu)
- Strip U+00AD (soft hyphen) and other zero-width chars from titles before insert.
- Fix the city/state parser: split on the `<br>` boundary properly so `data.city = "Jacksonville"` and `data.state = "Florida"` (not country-suffixed).
- Bump `AGENT_VERSION` to `v6-clean-strings` so we can confirm the new code is running.
- Optionally backfill the existing 20 rows with a one-shot SQL UPDATE that cleans titles and re-splits the city field — saves you re-scraping.

**Step 3 — Tell you when Stage 2 is safe to approve**
- I'll add a note to your mission/MissionStageCard UI: if a stage's `job_type` has no registered worker agent, show a small warning ("No worker agent registered for `client_enrichment` — approving will queue a job that won't run yet").
- Building the actual `client_enrichment` agent is a separate, larger task — let me know when you want to tackle it and I'll plan it (it'd visit each TEDx event page and pull organizer names/emails/social links).

## What I will NOT do

- Won't build the `client_enrichment` agent in this turn — it's a meaty task and you'll want to decide what fields to extract first.
- Won't change the mission Approve flow itself — it works correctly.
- Won't touch the worker process or run `git pull` for you — that's still your manual step.

## Your steps after I make the changes

1. Refresh the app → go to **Records** → you should see all 20 Florida TEDx rows with city/state filters.
2. On Ubuntu: `git pull && python -m signalhub_worker` to load the cleaned-string scraper.
3. Run the backfill SQL I'll give you (one paste into Supabase SQL editor) to fix the existing 20 rows' titles & cities.
4. Hold off on **Approve & continue** until we build the enrichment agent — I'll plan that next when you're ready.

