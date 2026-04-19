# Stage 3 — Hunter.io email enrichment for TEDx organizers

Goal: for every contact scraped in Stage 2 that's missing an email, query Hunter.io and capture **everything useful** Hunter returns (email, LinkedIn, Twitter, phone, confidence score, verification status, sources).

## Setup the user needs to do (one-time)

1. Sign up at [hunter.io](https://hunter.io) — free tier = 25 searches/month, paid starts ~$49/mo for 500.
2. Go to API → copy the API key.
3. In Lovable, add it as a secret named `HUNTER_API_KEY`. (I'll trigger the secret prompt when we get to implementation.)

## Schema changes

The `contacts` table is missing fields for what Hunter returns. Add (nullable) columns:

- `linkedin_url text`
- `twitter_url text`
- `email_verification_status text` — `deliverable` / `risky` / `undeliverable` / `unknown`
- `email_score int` — Hunter's 0–100 confidence
- `enrichment_sources jsonb` — array of `{ url, extracted_on, last_seen_on }` so we know where the email came from
- `enriched_at timestamptz` — when Stage 3 last touched this contact
- `enrichment_provider text` — `hunter` for now, leaves room for Apollo later

We'll keep the existing `social_url` column but new agents write to the typed columns above. The legacy `social_url` from Stage 2 stays as-is.

## Worker — new agent `email_lookup`

File: `worker/signalhub_worker/agents/email_lookup.py`
- Job type: `"email_lookup"`
- Payload: `{ project_id?, mission_id?, mission_stage_id?, finding_ids?, contact_ids?, max_lookups? }` — lets the mission target a specific batch or fall back to "all contacts in project missing email".
- For each candidate contact:
  1. Resolve a domain — try `contacts.website`, else parse from the event finding's `source_url`, else fall back to Hunter Domain Search using `contacts.organization`.
  2. Call Hunter **Email Finder**: `GET https://api.hunter.io/v2/email-finder?domain=...&first_name=...&last_name=...&api_key=...`.
  3. Map the response into the new columns. Skip writes if Hunter returns no email AND no socials (don't pollute rows with empty enrichment).
  4. Log every lookup to `job_logs` with the contact name, domain tried, and outcome (`found` / `not_found` / `error`).
- Rate limiting: Hunter free tier = 15 req/min, paid = 60 req/min. Sleep 4s between calls by default, configurable via env `HUNTER_RATE_LIMIT_PER_MIN`.
- Budget guard: stop and mark job `succeeded` early if `max_lookups` is hit, so a misconfigured mission can't burn the whole quota.
- Bump worker version to `v6-email-lookup`.

Register the agent in `worker/signalhub_worker/registry.py`.

## API + UI

1. `src/lib/api.ts` — add the new fields to `ContactRow` and `rowToContact`. (File is already 410 lines — I'll move the contact mapping into `src/lib/contactsMapping.ts` while I'm in there, mirroring `jobsMapping.ts`.)
2. `src/types/index.ts` — extend `Contact` with `linkedin?`, `twitter?`, `phone?` (already present), `emailVerification?`, `emailScore?`, `enrichmentSources?`, `enrichedAt?`.
3. `src/pages/Contacts.tsx`:
   - Show a small ✉️ verification chip next to email (`deliverable` = green, `risky` = amber, `undeliverable` = red).
   - Add LinkedIn icon link in the row when present.
   - Filter: "Missing email" / "Has email" toggle so we can target Stage 3 re-runs.
4. `src/pages/ContactDetail.tsx`:
   - New "Enrichment" section showing Hunter score, verification, when enriched, and a collapsible list of source URLs.
5. `src/components/missions/...` — add `email_lookup` as a selectable stage type in the mission builder, with a "Max lookups" number input so you can cap quota usage per stage.

## How you'll use it

1. Open the TEDx mission you already ran.
2. Add a new stage: **Stage 3 — Email lookup (Hunter.io)**, payload `{ max_lookups: 50 }` for the first run.
3. Click **Queue stage** → worker picks it up → contacts get enriched in place.
4. Approve the stage (or set `requires_review: false` if you want it auto-approve).

## Open questions before I build

- Quota: do you want me to default `max_lookups` to your monthly Hunter limit, or leave it unset (= enrich everything missing)?
- Verification: Hunter's Email Finder returns a basic verification automatically; do you also want me to call the separate **Email Verifier** endpoint for stronger confidence (uses 1 extra credit per email)?
- Re-enrichment: should the agent skip contacts already enriched within the last N days, or always overwrite when re-run?
