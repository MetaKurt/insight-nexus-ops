

## Root cause: the worker on your machine is running stale code

I dug into the database to verify what actually ran. Here's the smoking gun:

**Job `6237c875` payload (correct, new schema):**
```json
{ "country": "United States", "years": [2026, 2027],
  "available_only": true, "max_pages": 20, "limit": 300 }
```

**Job logs (OLD agent behavior):**
- `Scanning page 1 → https://www.ted.com/tedx/events?sort=newest&page=1`
  ← no `available=on`, no `country=`, no `year[]=` in the URL
- `Page 1: 44 cards seen, 0 kept`
  ← the new agent never says "cards seen" — this string was deleted

**My rewritten `worker/signalhub_worker/agents/tedx_scrape.py` (in this Lovable repo):**
- Builds URLs like `?available=on&country=United+States&year[]=2026&year[]=2027&page=N`
- Logs `Page N: X rows | kept Y | skipped past=A no_space=B …`
- Never uses the phrase "cards seen"

**Conclusion:** Your Ubuntu machine has a separate clone of the `worker/` folder. When I "edited" the file last turn, I edited it **here in the Lovable repo**, but your local Ubuntu copy was never updated. Restarting the worker re-loaded the same old file.

The DB `notes` field (`"Found 0 TEDx events…"`) looks like the new summary, but it was actually written by the old agent code — the old version's summary string just happens to be similar. The decisive evidence is the URL with no filters and the "cards seen" log text.

## The fix is two minutes of git, no code changes needed

You need to pull the latest `worker/` code from the Lovable project to your Ubuntu machine. Two paths:

### Option A — git pull (if your Ubuntu repo is the same git repo as this Lovable project)

```bash
cd ~/insight-nexus-ops      # or wherever your repo lives on Ubuntu
git pull
cd worker
# restart the worker
```

### Option B — rsync / scp the file (if the worker folder isn't in git on Ubuntu)

From your Ubuntu machine, copy the freshest `tedx_scrape.py` from wherever you downloaded the Lovable export, e.g.:
```bash
cp /path/to/fresh/insight-nexus-ops/worker/signalhub_worker/agents/tedx_scrape.py \
   ~/insight-nexus-ops/worker/signalhub_worker/agents/tedx_scrape.py
```
Then restart.

### How to verify the new code is running

After restarting, queue a fresh `tedx_scrape` job. Watch for one of these signals — any of them means the new code is active:

1. The URL printed in the logs contains `available=on&country=United+States&year[]=2026`
2. The per-page log line says `Page 1: N rows | kept …` instead of `cards seen`
3. The first log line says `TEDx scrape — country='United States' years=[2026, 2027] …` instead of `TEDx scrape starting — years 2026/2027, US only …`

If any of those don't show up, the file on disk is still the old one.

## What I'll do in this turn (when you switch me to default mode)

This is a deployment problem, not a code problem — the code in the repo is already correct. So I have two small things to add that will make this easier next time:

1. **Print the agent's file path + a version marker on startup**
   Add one line in `tedx_scrape.py`'s `run()` that logs the agent's file path. That way, both the worker terminal AND the database `job_logs` will tell us exactly which file is executing. No more "is the new code actually running?" guessing.

2. **Add a "Worker code version" banner to the worker README**
   A short "Pulling updates" section so the manual git-pull-and-restart step is documented next to the run instructions.

3. *(Optional)* **Show the URL it's about to fetch in the very first log line of any TEDx run** — already done in the new code, but I'll move it earlier so it appears before any DOM work, so failures are easier to spot.

## What I will NOT do

- I won't touch the scraping logic again. I confirmed against the live TED.com HTML that the rewritten parser, URL builder, and table selectors are correct. The 0-results problem is 100% caused by the old file still being on your machine.
- No DB migrations, no new tables, no new agents.

## What you do

After I make those small changes:
1. Pull the latest worker code to your Ubuntu machine (Option A or B above)
2. Restart `python -m signalhub_worker`
3. Create a fresh mission via `/missions/new`
4. The first stage's logs should show the `available=on&country=United+States&year[]=2026` URL and start returning real findings

