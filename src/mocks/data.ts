import type {
  Contact,
  Finding,
  Note,
  Project,
  Run,
  Source,
  SystemError,
  Tag,
  Workspace,
} from "@/types";

export const workspaces: Workspace[] = [
  { id: "ws-hotels", name: "Hotel Lead Gen", vertical: "hotels" },
  { id: "ws-tedx", name: "TEDx Opportunities", vertical: "tedx" },
  { id: "ws-nvr", name: "NVRLand", vertical: "nvrland" },
  { id: "ws-clients", name: "Client Outreach", vertical: "clients" },
  { id: "ws-general", name: "General Research", vertical: "general" },
];

export const tags: Tag[] = [
  { id: "t-hot", label: "hot", color: "destructive" },
  { id: "t-warm", label: "warm", color: "warning" },
  { id: "t-cold", label: "cold", color: "info" },
  { id: "t-luxury", label: "luxury", color: "primary" },
  { id: "t-boutique", label: "boutique", color: "primary" },
  { id: "t-event", label: "event", color: "info" },
  { id: "t-speaker", label: "speaker", color: "primary" },
  { id: "t-collector", label: "collector", color: "warning" },
  { id: "t-priority", label: "priority", color: "destructive" },
  { id: "t-followup", label: "follow-up", color: "warning" },
];

const isoDaysAgo = (d: number, h = 0) =>
  new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

export const projects: Project[] = [
  {
    id: "p-marriott",
    workspaceId: "ws-hotels",
    name: "Marriott Luxury Collection — EU",
    description: "Identify GMs and marketing directors at luxury Marriott properties across Europe.",
    status: "active",
    tags: ["luxury", "priority"],
    owner: "Maya Chen",
    createdAt: isoDaysAgo(42),
    updatedAt: isoDaysAgo(1),
    recordsCount: 312,
    contactsCount: 187,
    notesCount: 14,
  },
  {
    id: "p-boutique",
    workspaceId: "ws-hotels",
    name: "Boutique Hotels — Coastal Spain",
    description: "Independent boutique properties for partnership outreach.",
    status: "active",
    tags: ["boutique"],
    owner: "Liam Ortiz",
    createdAt: isoDaysAgo(21),
    updatedAt: isoDaysAgo(0, 4),
    recordsCount: 96,
    contactsCount: 41,
    notesCount: 6,
  },
  {
    id: "p-tedx-2026",
    workspaceId: "ws-tedx",
    name: "TEDx 2026 Speaker Pipeline",
    description: "Track upcoming TEDx events and identify speaker submission windows.",
    status: "active",
    tags: ["event", "speaker"],
    owner: "Priya Anand",
    createdAt: isoDaysAgo(60),
    updatedAt: isoDaysAgo(2),
    recordsCount: 218,
    contactsCount: 74,
    notesCount: 22,
  },
  {
    id: "p-nvr-collectors",
    workspaceId: "ws-nvr",
    name: "NVRLand Collector Insights",
    description: "Collector behavior research, top-buyer enrichment, secondary-market signals.",
    status: "active",
    tags: ["collector", "priority"],
    owner: "Devon Reyes",
    createdAt: isoDaysAgo(33),
    updatedAt: isoDaysAgo(0, 9),
    recordsCount: 451,
    contactsCount: 128,
    notesCount: 31,
  },
  {
    id: "p-nvr-campaign",
    workspaceId: "ws-nvr",
    name: "NVRLand Drop Campaign — Q2",
    description: "Track campaign signal across community channels and creator networks.",
    status: "planning",
    tags: ["follow-up"],
    owner: "Devon Reyes",
    createdAt: isoDaysAgo(8),
    updatedAt: isoDaysAgo(0, 1),
    recordsCount: 47,
    contactsCount: 19,
    notesCount: 4,
  },
  {
    id: "p-client-acme",
    workspaceId: "ws-clients",
    name: "Acme Robotics — VP Engineering Search",
    description: "Sourcing senior engineering leaders for Acme Robotics.",
    status: "active",
    tags: ["priority", "warm"],
    owner: "Sara Köhler",
    createdAt: isoDaysAgo(15),
    updatedAt: isoDaysAgo(0, 6),
    recordsCount: 134,
    contactsCount: 88,
    notesCount: 11,
  },
  {
    id: "p-general-ai",
    workspaceId: "ws-general",
    name: "AI Tooling Landscape",
    description: "Ongoing scan of new AI tooling companies, founders, and funding signals.",
    status: "active",
    tags: ["follow-up"],
    owner: "Maya Chen",
    createdAt: isoDaysAgo(90),
    updatedAt: isoDaysAgo(3),
    recordsCount: 612,
    contactsCount: 203,
    notesCount: 45,
  },
  {
    id: "p-archived",
    workspaceId: "ws-clients",
    name: "Q4 Outreach — Closed",
    description: "Archived end-of-year client research project.",
    status: "archived",
    tags: ["cold"],
    owner: "Sara Köhler",
    createdAt: isoDaysAgo(180),
    updatedAt: isoDaysAgo(45),
    recordsCount: 89,
    contactsCount: 56,
    notesCount: 9,
  },
];

export const sources: Source[] = [
  { id: "s-marriott-com", workspaceId: "ws-hotels", name: "marriott.com directory", type: "website", url: "https://www.marriott.com", health: "healthy", lastRunAt: isoDaysAgo(0, 2), recordsProduced: 312 },
  { id: "s-booking", workspaceId: "ws-hotels", name: "Booking.com listings", type: "directory", url: "https://booking.com", health: "degraded", lastRunAt: isoDaysAgo(1), recordsProduced: 96 },
  { id: "s-tedx-com", workspaceId: "ws-tedx", name: "ted.com/tedx events", type: "event_page", url: "https://www.ted.com/tedx", health: "healthy", lastRunAt: isoDaysAgo(0, 5), recordsProduced: 218 },
  { id: "s-tedx-x", workspaceId: "ws-tedx", name: "TEDx organizer X profiles", type: "social", health: "healthy", lastRunAt: isoDaysAgo(2), recordsProduced: 74 },
  { id: "s-opensea", workspaceId: "ws-nvr", name: "OpenSea collector wallets", type: "api", url: "https://api.opensea.io", health: "healthy", lastRunAt: isoDaysAgo(0, 1), recordsProduced: 451 },
  { id: "s-discord", workspaceId: "ws-nvr", name: "NVRLand Discord scrape", type: "social", health: "down", lastRunAt: isoDaysAgo(3), recordsProduced: 0 },
  { id: "s-linkedin", workspaceId: "ws-clients", name: "LinkedIn search", type: "social", health: "degraded", lastRunAt: isoDaysAgo(0, 8), recordsProduced: 134 },
  { id: "s-csv-import", workspaceId: "ws-general", name: "Manual CSV import", type: "csv", health: "healthy", lastRunAt: isoDaysAgo(7), recordsProduced: 240 },
  { id: "s-crunchbase", workspaceId: "ws-general", name: "Crunchbase API", type: "api", url: "https://crunchbase.com", health: "healthy", lastRunAt: isoDaysAgo(0, 3), recordsProduced: 372 },
];

const sample = <T,>(arr: T[], i: number) => arr[i % arr.length];

const findingTitles = [
  "Le Méridien Barcelona — Marketing Director Identified",
  "Boutique stay 'Casa Olivia' — owner profile",
  "TEDxLisbon 2026 — submissions open March",
  "TEDxAmsterdamWomen — organizer contact found",
  "NVRLand whale wallet 0x9a…f2 — 14 mints in 30d",
  "Acme Robotics — VP Eng candidate (Berlin)",
  "Stealth AI agent startup — 3 founders located",
  "Hotel Arts Barcelona — partnership lead",
  "TEDxBerlin — speaker rolodex extracted",
  "Collector cohort: 'long-term holders' segment",
  "Client referral signal: shared founder network",
  "Crunchbase: new Series A in dev tooling",
];

export const findings: Finding[] = Array.from({ length: 48 }).map((_, i) => {
  const proj = sample(projects.filter((p) => p.status !== "archived"), i);
  const src = sources.find((s) => s.workspaceId === proj.workspaceId) ?? sources[0];
  const statuses: Finding["status"][] = ["new", "in_review", "approved", "rejected", "flagged", "duplicate", "complete"];
  return {
    id: `f-${1000 + i}`,
    workspaceId: proj.workspaceId,
    projectId: proj.id,
    title: findingTitles[i % findingTitles.length],
    summary:
      "Auto-extracted summary describing the discovered entity, key context, and why it matched the project criteria.",
    sourceUrl: src.url ?? "https://example.com/result",
    sourceType: src.type,
    sourceId: src.id,
    status: statuses[i % statuses.length],
    confidence: 40 + ((i * 7) % 60),
    tags: i % 3 === 0 ? ["priority", "warm"] : i % 3 === 1 ? ["follow-up"] : ["cold"],
    extractedFields: {
      name: "Sample Entity " + i,
      location: ["Barcelona", "Lisbon", "Berlin", "Amsterdam", "Madrid"][i % 5],
      score: 40 + ((i * 13) % 60),
      url: src.url ?? null,
    },
    relatedContactIds: [],
    createdAt: isoDaysAgo(i % 30, i % 24),
    updatedAt: isoDaysAgo((i % 30) - 0, i % 24),
    assignedTo: i % 4 === 0 ? "Maya Chen" : undefined,
  };
});

const firstNames = ["Elena", "Marc", "Isabel", "Tomás", "Aida", "Niels", "Sofia", "Pedro", "Hannah", "Luca", "Mira", "Jonas"];
const lastNames = ["Vidal", "Klein", "Moreau", "Costa", "Rossi", "van Dijk", "Schmidt", "García", "Bauer", "Lefèvre"];
const orgs = [
  "Le Méridien Barcelona", "Casa Olivia", "TEDxLisbon", "TEDxAmsterdam", "NVRLand", "Acme Robotics",
  "Hotel Arts", "Stealth AI", "Crunchbase Co", "Indie Studio",
];
const roles = ["Marketing Director", "Founder", "Organizer", "VP Engineering", "Community Lead", "GM", "Curator"];

export const contacts: Contact[] = Array.from({ length: 36 }).map((_, i) => {
  const proj = projects[i % projects.length];
  const outreachStatuses: Contact["outreachStatus"][] = ["not_contacted", "queued", "contacted", "replied", "bounced", "do_not_contact"];
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[i % lastNames.length];
  return {
    id: `c-${2000 + i}`,
    workspaceId: proj.workspaceId,
    projectId: proj.id,
    name: `${fn} ${ln}`,
    organization: orgs[i % orgs.length],
    role: roles[i % roles.length],
    email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/\s+/g, "")}@${orgs[i % orgs.length].toLowerCase().replace(/[^a-z]/g, "")}.com`,
    phone: i % 3 === 0 ? `+34 6${String(10000000 + i * 137).slice(0, 8)}` : undefined,
    website: i % 4 === 0 ? `https://${orgs[i % orgs.length].toLowerCase().replace(/[^a-z]/g, "")}.com` : undefined,
    social: { linkedin: `https://linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase().replace(/\s+/g, "")}` },
    source: sources[i % sources.length].name,
    confidence: 45 + ((i * 11) % 55),
    outreachStatus: outreachStatuses[i % outreachStatuses.length],
    notes: i % 5 === 0 ? "Met briefly at conference last fall — warm intro possible." : undefined,
    createdAt: isoDaysAgo(i % 45, i % 24),
  };
});

export const runs: Run[] = Array.from({ length: 24 }).map((_, i) => {
  const proj = projects[i % projects.length];
  const src = sources.find((s) => s.workspaceId === proj.workspaceId) ?? sources[0];
  const statuses: Run["status"][] = ["success", "success", "success", "partial", "failed", "running", "queued"];
  const status = statuses[i % statuses.length];
  const started = isoDaysAgo(i % 14, i % 24);
  const duration = (i + 1) * 47000;
  return {
    id: `r-${3000 + i}`,
    workspaceId: proj.workspaceId,
    projectId: proj.id,
    type: ["scrape", "enrich", "search", "verify"][i % 4],
    sourceId: src.id,
    sourceLabel: src.name,
    status,
    startedAt: started,
    endedAt: status === "running" || status === "queued" ? undefined : new Date(new Date(started).getTime() + duration).toISOString(),
    durationMs: status === "running" || status === "queued" ? undefined : duration,
    recordsFound: status === "failed" ? 0 : 12 + (i * 7) % 80,
    contactsFound: status === "failed" ? 0 : 3 + (i * 3) % 25,
    errorsCount: status === "failed" ? 8 : status === "partial" ? 2 : 0,
    logs: [
      `[INFO] Starting ${["scrape", "enrich", "search", "verify"][i % 4]} run for ${src.name}`,
      `[INFO] Loaded ${10 + i} targets`,
      status === "failed" ? `[ERROR] Source returned 503 after 3 retries` : `[INFO] Processed ${12 + (i * 7) % 80} items`,
      status === "partial" ? `[WARN] 2 items failed parsing` : `[INFO] Run complete`,
    ],
  };
});

export const errors: SystemError[] = Array.from({ length: 14 }).map((_, i) => {
  const run = runs[i % runs.length];
  const cats: SystemError["category"][] = ["scrape", "parse", "missing_field", "low_confidence", "network", "auth", "other"];
  const sevs: SystemError["severity"][] = ["low", "medium", "high", "critical"];
  return {
    id: `e-${4000 + i}`,
    workspaceId: run.workspaceId,
    runId: run.id,
    projectId: run.projectId,
    sourceId: run.sourceId,
    message: [
      "Selector returned 0 matches on listing page",
      "Required field 'email' missing on 12 records",
      "Confidence below threshold (32%)",
      "Source returned HTTP 503",
      "Auth token expired mid-run",
      "Rate limit exceeded — backoff applied",
    ][i % 6],
    severity: sevs[i % sevs.length],
    category: cats[i % cats.length],
    createdAt: isoDaysAgo(i % 10, i % 24),
    resolved: i % 5 === 0,
  };
});

export const notes: Note[] = [
  { id: "n-1", entityType: "project", entityId: "p-marriott", author: "Maya Chen", body: "Focus next sweep on Spain + Portugal, skip already-mapped UK properties.", createdAt: isoDaysAgo(2) },
  { id: "n-2", entityType: "finding", entityId: "f-1000", author: "Liam Ortiz", body: "Confirmed via LinkedIn — title is current as of last week.", createdAt: isoDaysAgo(1) },
  { id: "n-3", entityType: "contact", entityId: "c-2001", author: "Priya Anand", body: "Prefers email over LinkedIn outreach.", createdAt: isoDaysAgo(0, 4) },
];
