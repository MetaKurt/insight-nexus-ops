

## What you're asking for

Right now your speakers (Alex Calle, Brian Shea, etc.) only show name + a one-line title. You want:

1. **Richer speaker info pulled from the TEDx event page** — bio, photo — visible in the UI.
2. **Speakers to flow through the LinkedIn + email pipeline** that organizers use (Stage 3 web enrich → Stage 4 Hunter email lookup).

## What's already in place

- Stage 2 (`client_enrichment`) **already scrapes the speaker's bio** from TED. It's just being dumped into the `notes` column as `"Bio: …"`, so the UI never displays it nicely.
- The `contacts` table already has `linkedin_url`, `website`, `email`, `email_verification_status`.
- Stage 3 (`contact_web_enrich`) already does Firecrawl searches like `"Alex Calle" "TEDxBocaRaton" LinkedIn`. Speakers fit its filter (no website, no LinkedIn) so it should already pick them up — we just need to actually run it on them.
- Stage 4 (`email_lookup`) finds emails via Hunter once a domain is known.

So this is mostly **surface existing data + verify the chain works end-to-end for speakers**, plus a tiny scraper improvement for photos.

## The plan

### 1. Worker — capture the speaker photo (small change)

In `worker/signalhub_worker/agents/client_enrichment.py`:

- In `_extract_speakers_from_event`, also grab the speaker's **photo URL** (the `<img>` near each speaker's `<h4>` on the TED page).
- In `_build_speaker_row`, keep the bio in `notes` as today, but add the photo cleanly so the UI can pick it out: `Photo: <url>`.

No DB migration — bio + photo live inside `notes`, parsed by the UI. (Tell me if you'd rather I add proper `bio` and `photo_url` columns; happy to do that with a small migration.)

### 2. UI — show bio + photo in the "Contacts from this event" card

Update `src/components/records/EventContactsCard.tsx`:

- Parse `notes` for `Bio:` and `Photo:` chunks.
- For speakers, render a richer row: small avatar (photo or initials), name, role, **2-line truncated bio with a "more" toggle**.
- Keep the small icon row (LinkedIn / Twitter / website / email) on the right.

```text
┌────────────────────────────────────────────────┐
│ Contacts from this event (11)  [Find LinkedIn] │
├────────────────────────────────────────────────┤
│ 🎤 SPEAKERS (9)                                │
│ ┌──┐ Alex Calle                       in 🌐 ✉ │
│ │AC│ Environment Designer                     │
│ └──┘ Designs immersive worlds for Disney…more │
└────────────────────────────────────────────────┘
```

### 3. One-click enrichment for this event's contacts

Add a button on the card header: **"Find LinkedIn & email"**. It queues a one-off Stage 3 + Stage 4 job scoped to **only the contacts from this event** (passes `contact_ids` in the payload). That way you don't have to re-run the whole mission to enrich one event.

The worker already supports `contact_ids` in both Stage 3 and Stage 4 payloads — no worker changes needed for this.

## Step-by-step rollout (you'll do these in order)

1. I implement the changes.
2. On the Ubuntu worker: `git pull` then restart (`sudo systemctl restart signalhub-worker`).
3. (One-time backfill for existing events) Re-run **Stage 2** on the TEDx mission so old speakers also get the photo URL. Future runs include it automatically.
4. On the TEDxBocaRaton record, click **"Find LinkedIn & email"** — wait ~2 min, refresh — speaker rows now show LinkedIn + email icons where found.

## A few choices before I start

- **Storage:** keep bio + photo inside `notes` (no migration, faster) — or add proper `bio` and `photo_url` columns (cleaner, one migration).
- **Enrichment scope of the new button:** speakers + organizers (one click covers everything) — or speakers only (cheaper if organizers were already enriched).
- **Avatar:** show real TED photo with initials fallback — or initials only (lighter look).

Reply with your preferences (or just say "go with the defaults: notes / speakers + organizers / real photo") and I'll implement.

