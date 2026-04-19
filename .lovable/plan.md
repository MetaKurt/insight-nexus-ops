

# Project Architecture: Multi-Stage Research Pipelines

You're asking exactly the right question, and the answer shapes the whole product. Let me lay out my thinking, then propose a concrete architecture.

## The core insight

What you described — "find TEDx events → for each event, find organizers → for each organizer, find their email/LinkedIn" — is a **Directed Acyclic Graph (DAG) of jobs**, not a single job. Each stage:
- Has a different agent type
- Produces records that become inputs for the next stage
- Should be inspectable and approvable between stages
- May need different tools (browser scrape vs. LinkedIn API vs. email enrichment vs. LLM extraction)

Trying to cram this into one mega-prompt is brittle. Doing it as fully separate manual jobs is tedious. The right answer is in the middle.

## Recommended architecture: "Missions" with stages

```text
Mission: "TEDx US 2026/2027 Outreach"
│
├─ Stage 1: Discover events       (agent: tedx_scrape)
│     output → findings table (200 events)
│     [HUMAN REVIEW GATE — approve/reject]
│
├─ Stage 2: Enrich organizers     (agent: organizer_lookup)
│     input  ← approved findings from Stage 1
│     output → contacts table (200 organizers)
│     [HUMAN REVIEW GATE]
│
├─ Stage 3: Find emails/LinkedIn  (agent: contact_enrich)
│     input  ← approved contacts from Stage 2
│     output → enriched contacts
│
└─ Stage 4: (optional) Draft outreach  (agent: llm_draft)
```

Each stage is a separate `job` row. A `mission` row ties them together. The dependency engine auto-queues stage N+1 when stage N is approved.

## Your "talk to an agent first" instinct is correct

You shouldn't be hand-writing prompts like the Claude one you pasted. We should build a **Mission Builder chat** — a conversational interface that:
1. You describe the goal in plain English
2. An LLM (Lovable AI Gateway — Gemini/Claude/GPT, no API key needed) asks clarifying questions
3. It proposes a multi-stage mission plan
4. You approve, and it writes the job rows for you

This keeps prompt engineering out of your daily workflow.

## Proposed phased build

I want to do this in 3 chat-sized phases so we don't bite off too much:

### Phase A — Foundation: Missions + Stages (this turn)
- New tables: `missions`, `mission_stages`
- A stage references a `job_type` and a `payload`
- A stage has `depends_on_stage_id` and `status` (pending/queued/running/awaiting_review/approved/done)
- When a stage finishes, an Edge Function checks if downstream stages can be auto-queued
- New Mission Control page: Missions list + Mission detail (DAG view)

### Phase B — Mission Builder chat
- A `/missions/new` chat page using Lovable AI Gateway
- LLM uses tool-calling to propose a mission plan as JSON
- You review the plan, hit "Create Mission", it writes rows
- Saves you from ever writing raw prompts again

### Phase C — Connect downstream agents
- `organizer_lookup` agent (Firecrawl on each event URL)
- `contact_enrich` agent (Hunter.io / Apollo / Perplexity for emails + LinkedIn)
- These read from `findings` produced by upstream stages

## What I need from you before building

I want to confirm 4 design choices before writing code. They're below.

## Technical sketch (for reference)

```text
missions
  id, name, description, status, created_by, created_at

mission_stages
  id, mission_id, order_index, name,
  job_type, payload (jsonb),
  depends_on_stage_id (nullable),
  requires_review (bool, default true),
  status, job_id (nullable), created_at

flow:
  user creates mission with N stages
  → stage 1 auto-queued (creates a job row)
  → worker runs job
  → on complete: stage marked awaiting_review
  → user clicks "Approve" → next stage queued with upstream output as input
```

