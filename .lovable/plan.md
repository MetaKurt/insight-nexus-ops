
The user wants to link contacts to their TEDx event. We capture event name/date on findings, but contacts don't show which event they organize.

Looking at the schema:
- `contacts` table has `finding_id` (nullable) — likely already populated by the scraper since each organizer is scraped from an event page (a finding)
- `findings.title` holds the event name, `findings.data` holds date/state

Need to verify the worker actually sets `finding_id` when inserting contacts. Let me check.

Plan:

## Link contacts to their TEDx event

**1. Worker: ensure `finding_id` is set on contact rows**
- In `worker/signalhub_worker/agents/client_enrichment.py`, confirm/add `finding_id` to the contact upsert payload so each organizer points to the event finding they came from.
- Also write the event name into `contacts.organization` (e.g. "TEDxBoston") so it shows up in the existing Organization column without any UI change — currently that column is empty.

**2. API: join finding when loading contacts**
- In `src/lib/api.ts`, update `contacts.list` and `contacts.get` to also fetch the related finding (title + key data fields) via `finding_id`.
- Extend `rowToContact` to surface an `event` field: `{ id, name, date, state }`.

**3. Types**
- Add optional `event?: { id, name, date?, state? }` to the `Contact` type in `src/types/index.ts`.

**4. UI: Contacts page**
- Add an "Event" column to the table in `src/pages/Contacts.tsx`, linking to `/records/{findingId}`.
- Show event name + small date underneath.

**5. UI: Contact detail**
- On `src/pages/ContactDetail.tsx`, add an "Event" section linking back to the source finding.

**6. Backfill existing rows (one-shot SQL)**
- For contacts already inserted without `finding_id`/organization, attempt to backfill by matching the most recent finding from the same scrape run. If not feasible cleanly, just re-run Stage 2 after the worker fix to repopulate.

### Technical notes
- No schema change needed — `contacts.finding_id` already exists.
- Worker version bump to `v5-link-event`.
- After deploy, user pulls worker, restarts, clicks **Re-run** on Stage 2.
