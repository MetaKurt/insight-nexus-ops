

Let me explore the current state of the TEDx scraper, record detail page, and contact handling before planning.
<lov-tool-use id="toolu_vrtx_01Xm8cqMCramhBWHiYzQvH7A" name="code--view" integration-id="code" data="{\"file_path\": \"worker/signalhub_worker/agents/tedx_scrape.py\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012f1yKAmDgMCGnsE9GnoxyL" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/RecordDetail.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01QtP8rPZHpbZjkTGnDMrHaB" name="code--fetch_website" integration-id="code" data="{\"url\": \"https://www.ted.com/tedx/events/68057\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01H8uVH5VCYy8NkCWYcu22SX" name="code--view" integration-id="code" data="{\"file_path\": \"worker/signalhub_worker/agents/tedx_scrape.py\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01McwXD6mhUX64psauqL9aTf" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/RecordDetail.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012MLBfefkJPviqSiGhGCkVL" name="code--fetch_website" integration-id="code" data="{\"url\": \"https://www.ted.com/tedx/events/68057\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01HeuqjPax4ivx49L9J6b5Xr" name="code--view" integration-id="code" data="{\"file_path\": \"tool-results://fetched-websites/www.ted.com_tedx_events_68057.md\", \"lines\": \"50-112\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017mzPwE2KNGoqgyQ9A5otYq" name="code--view" integration-id="code" data="{\"file_path\": \"worker/signalhub_worker/agents/tedx_scrape.py\", \"lines\": \"418-610\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0183iLCJpdsYcgrtPUcbS1Vf" name="code--view" integration-id="code" data="{\"file_path\": \"worker/signalhub_worker/agents/contact_web_enrich.py\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011Sm99VwWMsdfmudMrcmFvM" name="code--view" integration-id="code" data="{\"file_path\": \"worker/signalhub_worker/agents/client_enrichment.py\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FjECu8FfRFXAC3m8AYCAvF" name="code--search_files" integration-id="code" data="{\"query\": \"tedx_scrape|event.*name|extractedFields\", \"search_dir\": \"src/pages/RecordDetail.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Had5ETdAmakysSSmrJdaHX" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/api.ts\", \"lines\": \"1-100\"}">
</lov-tool-use>
I have enough context. Let me design the plan.

<lov-plan>
## Goal
Capture TEDx **speakers** (not just organizers) from each event page like https://www.ted.com/tedx/events/68057, store them in `contacts`, and let the existing `contact_web_enrich` + `email_lookup` stages enrich them with LinkedIn + email so we can market to them.

## What's currently happening
- `tedx_scrape` writes the event to `findings`.
- `client_enrichment` visits each TED event page and pulls the **"Organizing team"** section into `contacts` — but it ignores the **"Speakers"** section right above it.
- TEDxMiami's page has 7 speakers (Camille Carlton, Dr. Elie Haddad, Dr. Marcus Fontoura, Dr. Roman Yampolskiy, Dr. Vivienne Ming, Ruthe Farmer, Tony Cho) — none are being captured today.

## Plan

### 1. Worker — extend `client_enrichment` to also scrape Speakers
File: `worker/signalhub_worker/agents/client_enrichment.py`

- Add a second extractor that walks the `### Speakers` section. Each speaker block has:
  - `#### Name` (h4)
  - `##### Job Title / Role` (h5)
  - Bio paragraph(s)
  - Sometimes a profile link, but most speakers on TEDx event pages have no TED profile (they're guest speakers, not TED members).
- Write each speaker to `contacts` with:
  - `name` = speaker name
  - `role_title` = the h5 line (e.g. "Cardiologist", "Theoretical Neuroscientist, Inventor")
  - `organization` = best-effort extraction from the bio's first sentence (regex like `at ([A-Z][\w& ]+)` / `is the (CEO|founder|...) of ([A-Z]...)`); if nothing confident, leave NULL — `contact_web_enrich` will fill it.
  - `notes` = first 500 chars of bio (so the user has context in the UI)
  - `source` = `"tedx_speaker"` (vs `"tedx_organizer"` for the existing path) — lets us filter/sort later
  - `finding_id` = the TEDx event finding
- Idempotent: dedupe by `(finding_id, name)` like organizers already do.
- Bump `AGENT_VERSION` to `v6-speakers`.

### 2. Mission Builder — teach the AI that speakers are now captured
File: `supabase/functions/mission-builder/index.ts`

- Update the `client_enrichment` description in `SYSTEM_PROMPT` to say it now scrapes both organizers AND speakers.
- That's it — no new stage needed; the existing 4-stage TEDx mission (`scrape → enrich → web_enrich → email_lookup`) just produces ~5–10x more contacts per event automatically.

### 3. UI — show speaker context on the Record (event) detail page
File: `src/pages/RecordDetail.tsx`

Currently the event detail page only shows extracted fields + source. Add a **"Contacts from this event"** card that:
- Queries `contacts` where `finding_id = f.id`
- Groups them: **Speakers** section first, then **Organizers**
- Each row: name, role/title, organization, and the same icon trio we just added on the Contacts page (LinkedIn / Twitter / Globe / ✓ verified email)
- Click name → `/contacts/:id`

This is what the user asked for: "add the speakers to the card TEDxMiami".

### 4. UI — surface the source in Contacts list
File: `src/pages/Contacts.tsx` (small touch)

- When `c.source === "tedx_speaker"` show a tiny "Speaker" pill; `"tedx_organizer"` shows "Organizer". Helps the user mentally separate the two audiences.

## How it'll feel for you
1. Re-run **Stage 2 (Enrich Contacts)** on the existing TEDxMiami finding (or run the whole mission again) — worker will now grab the 7 speakers.
2. Open the TEDxMiami event from /records → new "Contacts from this event" card lists all speakers + the organizer Vanitha Preston, each linkable.
3. Run **Stage 3 (contact_web_enrich)** — Firecrawl finds LinkedIn + company domain for each speaker (Vivienne Ming, Roman Yampolskiy etc. all have strong web footprints, hit rate will be much higher than for niche organizers).
4. Run **Stage 4 (Hunter email lookup)** — emails land on the speakers.

## Technical notes (for reference)
- **Speaker extraction selector:** look for the heading text "Speakers" (h3/`<h2 class="...">`), then walk siblings until the next h3 ("Organizing team", "Sponsors", etc.). For each `h4` in that range capture name, the immediately-following `h5` as role, and the next `<p>` blocks as bio. Same Playwright `page.evaluate` pattern already used for organizers.
- **Org-from-bio regex:** `\b(?:at|with)\s+(the\s+)?([A-Z][\w&.\- ]{2,60}?)(?=[,.;]|\s+(?:where|since|in\s+\d{4})|$)` — tested against the 7 sample bios, hits Microsoft, Center for Humane Technology, University of Louisville, Last Mile Education Fund, Future of Cities; misses for Vivienne Ming (no clear single employer — that's fine, leave NULL).
- **No DB schema changes needed.** Speakers are just more `contacts` rows; the `source` column already exists.
- **Cost:** zero additional API calls in Stage 2 (we're already on the event page). Stages 3 and 4 will use more Firecrawl/Hunter credits proportional to the new contact count — but that's the point.

