# SignalHub Worker

A Python job worker that runs on your Ubuntu server, picks up jobs from the
SignalHub Supabase database, and executes them. The dashboard never runs
anything itself — it only writes structured job requests. This worker is the
only thing that touches the outside world.

```
[Dashboard] --insert into jobs--> [Supabase] <--realtime + RPCs-- [this worker]
```

## What it does

- **Heartbeat loop** — every 10s, upserts the `workers` row so the dashboard
  knows this machine is alive.
- **Realtime subscription** — listens for new rows on `jobs` and immediately
  tries to claim one.
- **Atomic claim** — uses the `claim_next_job` Postgres RPC with `FOR UPDATE
  SKIP LOCKED` so two workers can never grab the same job.
- **Pluggable agents** — each `job_type` maps to a Python class in
  `agents/`. Add new agents without touching the core loop.
- **Live logs** — every `log()` call is batched and streamed into `job_logs`
  so you see progress in the dashboard log panel as it happens.
- **Finalization** — on success/failure, calls the `complete_job` RPC which
  updates status, counts, and frees the worker row.

## Setup

### 1. Clone & install

```bash
git clone <your repo>  # or scp the worker/ folder to ~/signalhub-worker
cd ~/signalhub-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
playwright install-deps chromium   # one-time, installs Chromium's system libs
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

Fill in:
- `SUPABASE_URL` — `https://iwpjlenmopdsaswqdlop.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — copy from Supabase dashboard → Project Settings
  → API → `service_role` key. **This bypasses RLS — keep it on the server only,
  never in the dashboard frontend, never committed to git.**
- `WORKER_NAME` — anything unique, e.g. `ubuntu-home-01`
- `WORKER_ENV` — `production`, `staging`, or `local`

### 3. Run it

Foreground (for testing):

```bash
python -m signalhub_worker
```

You should see:

```
[heartbeat] worker registered as ubuntu-home-01 (production v0.1.0)
[claimer] subscribed to jobs realtime channel
[claimer] no queued jobs — waiting...
```

Now go to the dashboard, click "Run TEDx Scrape", fill the form, hit Queue.
Within ~1 second you should see the worker pick it up and start streaming
logs back into the dashboard.

### 4. Run as a service (recommended)

```bash
sudo cp systemd/signalhub-worker.service /etc/systemd/system/
sudo nano /etc/systemd/system/signalhub-worker.service   # set User= and WorkingDirectory=
sudo systemctl daemon-reload
sudo systemctl enable --now signalhub-worker
sudo journalctl -u signalhub-worker -f                  # tail logs
```

## Pulling updates (IMPORTANT)

The dashboard repo and this worker share the same git repo, but the worker
runs from a **separate clone on your server**. Editing code in Lovable does
**not** automatically update the file on your worker machine. After any
change to `worker/`, you must pull and restart:

```bash
cd ~/signalhub-worker          # or wherever you cloned the repo
git pull
# if requirements.txt changed:
source .venv/bin/activate && pip install -r requirements.txt
# then restart:
#   foreground:  Ctrl+C, then `python -m signalhub_worker`
#   systemd:     sudo systemctl restart signalhub-worker
```

### How to confirm the new code is actually running

Every agent logs its **file path + version marker** as the first line of
each job. After restarting, queue a fresh job and check the log panel — you
should see something like:

```
tedx_scrape agent v=2026-04-19.table-parser-v1 file=/home/ubuntu/signalhub-worker/worker/signalhub_worker/agents/tedx_scrape.py
```

If the version string doesn't match what's in the repo, the worker is
still running stale code (most likely a second worker process or a systemd
service is still up). Run `ps aux | grep signalhub_worker` to find it.

## Adding a new agent

1. Create `signalhub_worker/agents/my_new_agent.py`:

   ```python
   from .base import BaseAgent, AgentResult, AgentContext

   class MyNewAgent(BaseAgent):
       job_type = "my_new_agent"

       async def run(self, payload: dict, ctx: AgentContext) -> AgentResult:
           ctx.log("info", "Starting my new agent")
           # ...do work, write rows to findings/contacts/etc...
           return AgentResult(records_created=42, summary="Did the thing")
   ```

2. Register it in `signalhub_worker/registry.py`:

   ```python
   from .agents.my_new_agent import MyNewAgent
   REGISTRY[MyNewAgent.job_type] = MyNewAgent
   ```

3. Restart the worker. Done. The dashboard's launch panel already supports
   arbitrary `job_type` strings, so you can either add it to the catalog in
   `src/mocks/jobs.ts` for a nice button, or queue it directly via SQL.

## File layout

```
worker/
├── README.md
├── requirements.txt
├── .env.example
├── signalhub_worker/
│   ├── __init__.py
│   ├── __main__.py            # entry point
│   ├── config.py              # env loading
│   ├── supabase_client.py     # service-role client
│   ├── heartbeat.py           # 10s upsert loop
│   ├── claimer.py             # realtime sub + RPC claim
│   ├── logger.py              # batched log streaming → job_logs
│   ├── registry.py            # job_type -> AgentClass mapping
│   └── agents/
│       ├── __init__.py
│       ├── base.py            # BaseAgent, AgentContext, AgentResult
│       ├── hello.py           # smoke-test agent
│       └── tedx_scrape.py     # the real TEDx events scraper
└── systemd/
    └── signalhub-worker.service
```

## Troubleshooting

**Worker shows online but doesn't pick up jobs.**
The job's `job_type` isn't in the registry. Add it (see "Adding a new agent")
or queue a job whose type matches one already registered.

**`401` or `permission denied for table jobs`.**
You're using the anon key instead of the service role key. The worker MUST
use service role.

**`column "machine_name" does not exist`.**
You haven't run the latest Supabase migration. The dashboard owner should
run it from Lovable.

**TEDx scraper returns 0 events.**
TED.com sometimes shifts their DOM. Run with `HEADLESS=false` in `.env` to
watch what's happening. The agent has a retry loop + screenshot-on-failure
that uploads to `job_logs` for debugging.
