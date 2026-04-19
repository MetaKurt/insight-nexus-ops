
# SignalHub — Build Plan

A modular internal ops dashboard for research, scraping, lead enrichment, and review workflows. Built frontend-first with mock data, structured to drop into an existing Supabase backend later.

## Design system
- **Theme**: dark neutral (near-black surfaces) with emerald as the primary accent; subtle slate borders, soft elevation, generous spacing.
- **Type**: clean sans (Inter), tabular numerals for tables.
- **Tokens** in `index.css` + `tailwind.config.ts`: semantic colors (background, surface, surface-elevated, border, muted, primary=emerald, success, warning, danger, info), status badge colors, tag chip colors, radii, shadows.
- **Reusables**: `DataTable` (sortable/filterable/bulk-select), `FilterBar`, `StatusBadge`, `TagChip`, `ConfidenceMeter`, `StatCard`, `EmptyState`, `PageHeader`, `SectionCard`, `DetailField`, `Timeline`, `LogViewer`, `KeyValueGrid`.

## App shell
- Collapsible sidebar (icon-mini mode) + top header.
- **Header**: workspace/project switcher (scopes the entire app via context), global search (⌘K command palette), notifications bell, user menu.
- **Sidebar nav**: Dashboard, Projects, Records, Contacts, Runs, Sources, Review Queue, Errors, Settings.
- Workspace scope persisted in `localStorage`; "All workspaces" option available.

## Pages

**1. Dashboard** — KPI cards (total records, active projects, contacts found, jobs today, error rate), area chart of records over time, recent runs list, recent contacts, vertical breakdown cards (Hotels, TEDx, NVRLand, Clients, General Research), failed-jobs strip.

**2. Projects** — Grid of project cards (name, status, tags, owner, counts of records/contacts, last activity) + list toggle. "New Project" dialog. Project detail page with overview, linked records, linked contacts, runs, notes tabs.

**3. Records** — Powerful table: search, multi-filter (project, status, source type, tag, confidence range, date), sort, bulk actions (tag, change status, export, mark complete). Dedicated record detail page with summary, source URL, extracted fields, structured findings, confidence, related contacts, notes, activity timeline, action bar (Review, Tag, Assign, Mark Complete, Export).

**4. Contacts** — CRM-style table (name, org, role, email, phone, source, confidence, outreach status). Detail page with contact info, social links, related project/records, outreach timeline, notes.

**5. Runs / Jobs** — Table with run id, type, project, source, start/end, duration, status, counts. Detail page with status timeline, log viewer, linked outputs, error summary, retry placeholder.

**6. Sources** — Cards/table of sources with type (website, event page, directory, CSV, API, manual), health indicator, last successful run, records produced. Add/edit dialog.

**7. Review Queue** — Toggle between **Inbox view** (list with bulk approve/reject/flag) and **Focus view** (one card at a time with keyboard shortcuts: A approve, R reject, F flag, T tag, → skip). Filters by project/source/confidence.

**8. Errors / System Health** — Status counters (failed, low-confidence, missing fields, retry-needed), filterable error list, grouping by run/source, retry placeholder.

**9. Settings** — Tabs: Backend Connection (Supabase status placeholder with "Connect" CTA), Integrations (API keys placeholders), Workspaces, Tags manager, Status pipelines manager, Categories, Users & Roles (placeholder).

## Mock data & backend-ready architecture
- `src/mocks/` with realistic seed data across all entities (projects, runs, findings, contacts, sources, errors, tags, notes) covering Hotels, TEDx, NVRLand, Clients, General Research.
- `src/lib/api/` with typed service modules (`projects.ts`, `records.ts`, `contacts.ts`, `runs.ts`, `sources.ts`, `notes.ts`, `errors.ts`) — each currently returns mock data via React Query, but signatures match what Supabase calls will look like. Swapping to Supabase later = changing the body of these functions only.
- `src/types/` with shared entity types (Project, Record/Finding, Contact, Run, Source, Note, Error, Tag) — flexible/extensible field shapes so multiple verticals fit without redesign.
- Workspace context provider feeds a `workspaceId` filter into every query.

## UX details
- Empty states everywhere with helpful illustrations + CTA.
- Loading skeletons on all tables/cards.
- Toasts for actions (sonner).
- Status badges + tag chips consistent across pages.
- Action buttons (View, Review, Retry, Assign, Tag, Export, Mark Complete) wired to no-op handlers + toast confirmation, ready for backend.
- Responsive: sidebar collapses to icons on tablet, becomes sheet on mobile; tables become stacked cards on mobile.

## Out of scope (placeholders only)
Real Supabase wiring, auth, role enforcement, real exports, real retry execution, file uploads — all stubbed with clear "Connect backend" affordances.
