
Goal: make it obvious why the web app shows live job activity while your Ubuntu terminal can look “stuck,” and make worker activity easier to see inside the app.

What I found
- The Log Stream is reading from the `job_logs` table in Supabase.
- Your worker writes those logs into Supabase in `worker/signalhub_worker/logger.py`.
- Your Ubuntu service is configured with `StandardOutput=journal` and `StandardError=journal`, which means the terminal will stay static unless you are actively following the journal.
- So this mismatch is expected today: the app can update live from DB events even when the terminal window itself does not move.

Plan
1. Add a clearer live worker status area
- Show worker name, current status, last heartbeat, and current job more prominently.
- Add a “recent worker activity” line so short jobs do not feel invisible.

2. Add a simple explanation in the UI
- On Control Center / Job Detail, add a short note like:
  “Logs update from Supabase in real time. On Ubuntu, use journal follow mode to watch console output live.”
- Include the exact command in copy-friendly form.

3. Make time labels refresh on their own
- `WorkerStatusPanel` currently computes “Heartbeat 5s ago” from `Date.now()`, but it only re-renders when data changes.
- I’ll add a small ticking hook so “5s ago / 10s ago / 1m ago” updates continuously and does not look frozen.

4. Improve the Job Detail page
- Since you were on a job detail route, I’ll show the assigned worker more clearly there, including whether it is still busy or already idle.
- If the job finished quickly, the UI should make that obvious instead of seeming like the worker never ran.

5. Validate the full flow
- Start a mission, watch the worker become busy, see logs appear, then confirm it returns to idle after completion.
- Check both a fast job and a longer-running job.

Files likely involved
- `src/components/control-center/WorkerStatusPanel.tsx`
- `src/pages/JobDetail.tsx`
- `src/pages/ControlCenter.tsx`
- possibly a small new hook/helper for auto-refreshing relative timestamps
- no backend or database migration needed for the first pass

Technical details
- `LogStream` uses `api.jobLogs.listAll()` / `listForJob()` from `src/lib/api.ts`.
- Realtime invalidation already exists in `src/hooks/useJobsRealtime.ts` for `jobs`, `job_logs`, and `workers`.
- Worker output to Ubuntu is handled by systemd journal via `worker/systemd/signalhub-worker.service`.
- This is mainly a UX/clarity issue, not a worker failure.

Expected result
- The app will better explain what is happening.
- Worker cards and job pages will feel “live” instead of static.
- You will be able to tell at a glance whether the Ubuntu worker picked up the job, finished quickly, or is still running.
