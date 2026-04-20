// Mission Builder chat — non-streaming.
//
// The LLM has two jobs:
//   1) Ask clarifying questions in plain English.
//   2) When it has enough info, call the `propose_mission_plan` tool with a
//      structured plan the frontend can preview and create with one click.
//
// We use tool-calling for the structured part (more reliable than asking the
// model to return raw JSON inside prose). Conversational replies come back as
// a normal assistant message.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Keep this list in sync with src/mocks/jobs.ts (jobTypeCatalog).
const JOB_TYPES = [
  "hello",
  "tedx_scrape",
  "hotel_lead_research",
  "nvrland_research",
  "client_enrichment",
  "contact_web_enrich",
  "email_lookup",
  "retry_failed_records",
  "refresh_source_scan",
  "export_data",
];

const SYSTEM_PROMPT = `You are the Mission Builder for SignalHub — a multi-stage research automation platform.

The user describes a research goal. Your job:
1. Ask focused clarifying questions one at a time until you understand the goal, scope, and any filters.
2. When confident, call the \`propose_mission_plan\` tool with an ordered list of stages.

A "mission" is a directed pipeline of stages. Each stage runs as a job on a worker fleet.

AVAILABLE JOB TYPES (you MUST pick from this list):
- hello — diagnostic / smoke test
- tedx_scrape — scrape TEDx event listings (filterable by location, year, status)
- hotel_lead_research — find hotel leads matching criteria
- nvrland_research — broad research workflow for NvrLand
- client_enrichment — enrich existing records with extra data
- contact_web_enrich — Firecrawl-powered web search to find each contact's real employer, company website domain, and LinkedIn URL. ALWAYS use this BEFORE email_lookup if contacts came from a scraper that only captured social URLs (TEDx, event sites, etc.) — Hunter.io needs real company domains to find emails.
- email_lookup — Hunter.io email finder. Requires contacts to have a real company domain in contacts.website (use contact_web_enrich first if not).
- retry_failed_records — re-run records that previously errored
- refresh_source_scan — rescan a source for new items
- export_data — export records to CSV/JSON

DESIGN GUIDELINES:
- Prefer 2–4 stages. Each stage should have a clear, single responsibility.
- Stage 1 typically gathers data; later stages enrich it.
- Set \`requires_review: true\` for stages where a human should approve results before the next stage runs (default to true unless the user says otherwise).
- Use \`depends_on_index\` to express dependencies (0-based index of the prior stage). Use \`null\` for the first stage or for stages that can run in parallel.
- Put concrete parameters into each stage's \`payload\`. Use the schemas below.

PAYLOAD SCHEMAS (use the EXACT keys shown — the agent code expects them):

tedx_scrape:
  {
    "country": "United States",       // full country name, exactly as TED writes it
    "years": [2026, 2027],            // array of 4-digit years
    "available_only": true,           // only events with spaces available
    "max_pages": 10,                  // listing pages to scan (1-100), 5-15 is plenty
    "limit": 500,                     // hard cap on findings created
    "location": "Florida",            // OPTIONAL: US state or city to narrow results (matches against scraped state/city)
    "keywords": "youth, women"        // OPTIONAL: comma-separated tokens that must appear in the EVENT NAME (e.g. "youth", "women")
  }
  CRITICAL RULES for tedx_scrape:
  - If the user names a US state (e.g. "Florida", "California"), put it in "location" — NEVER in "keywords".
    Event names like "TEDxBrooklyn" or "TEDxYouth@Tampa" rarely contain state names, so a "Florida" keyword filter would drop everything.
  - "keywords" is ONLY for words you expect to literally appear in the event name itself (e.g. "youth", "women", "tech").
  - If the user has no name preference, OMIT "keywords" entirely.
  - Do NOT use "year_min", "year_max", or "status" — those are legacy keys.

hotel_lead_research / nvrland_research / client_enrichment:
  { "location": "...", "keywords": "...", "limit": 100, "notes": "..." }

retry_failed_records / refresh_source_scan:
  { "projectId": "<uuid>", "limit": 100 }

export_data:
  { "projectId": "<uuid>", "format": "csv" | "json" }

hello:
  { } // empty payload — diagnostic only

CONVERSATION STYLE:
- Plain English, no jargon. Short replies.
- Ask ONE clarifying question at a time, not a bulk list.
- Once you propose a plan via the tool, also send a brief one-paragraph summary so the user knows what to look for.
- If the user says "looks good" or similar after a plan, do NOT propose again — just acknowledge.`;

const TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "propose_mission_plan",
    description:
      "Propose a complete multi-stage mission plan for the user to review. Only call this when you have enough information to commit to specific stages and payloads.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Short title for the mission (max ~80 chars).",
        },
        description: {
          type: "string",
          description: "1-2 sentence summary of what this mission accomplishes.",
        },
        stages: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Short stage name." },
              description: {
                type: "string",
                description: "What this stage produces.",
              },
              job_type: {
                type: "string",
                enum: JOB_TYPES,
                description: "Which agent runs this stage.",
              },
              payload: {
                type: "object",
                description:
                  "JSON parameters passed to the agent. Free-form keys like location, limit, year, keywords, urls.",
                additionalProperties: true,
              },
              requires_review: {
                type: "boolean",
                description: "Pause for human approval after this stage completes.",
              },
              depends_on_index: {
                type: ["integer", "null"],
                description:
                  "0-based index of the stage this depends on. null if it can start immediately or run in parallel.",
              },
            },
            required: [
              "name",
              "description",
              "job_type",
              "payload",
              "requires_review",
              "depends_on_index",
            ],
          },
        },
      },
      required: ["name", "description", "stages"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          tools: [TOOL_DEFINITION],
          tool_choice: "auto",
        }),
      },
    );

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit hit. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({
          error:
            "Lovable AI credits exhausted. Add credits in Settings → Workspace → Usage.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(
        JSON.stringify({ error: `AI gateway error (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message ?? {};
    const content: string = choice.content ?? "";
    const toolCalls = choice.tool_calls ?? [];

    let plan: unknown = null;
    for (const tc of toolCalls) {
      if (tc.function?.name === "propose_mission_plan") {
        try {
          plan = JSON.parse(tc.function.arguments ?? "{}");
        } catch (e) {
          console.error("Failed to parse plan args:", e);
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({
        content,
        plan,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("mission-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
