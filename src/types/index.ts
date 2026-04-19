// SignalHub shared entity types — designed to map cleanly to a Supabase schema later.

export type ID = string;

export type Vertical = "hotels" | "tedx" | "nvrland" | "clients" | "general";

export type ProjectStatus = "active" | "paused" | "archived" | "planning";

export interface Workspace {
  id: ID;
  name: string;
  vertical: Vertical;
  color?: string;
}

export interface Project {
  id: ID;
  workspaceId: ID;
  name: string;
  description: string;
  status: ProjectStatus;
  tags: string[];
  owner: string;
  createdAt: string;
  updatedAt: string;
  recordsCount: number;
  contactsCount: number;
  notesCount: number;
}

export type RecordStatus =
  | "new"
  | "in_review"
  | "approved"
  | "rejected"
  | "flagged"
  | "duplicate"
  | "complete";

export type SourceType =
  | "website"
  | "event_page"
  | "social"
  | "directory"
  | "manual"
  | "csv"
  | "api"
  | "tedx_events";

export interface Finding {
  id: ID;
  workspaceId: ID;
  projectId: ID;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceType: SourceType;
  sourceId?: ID;
  status: RecordStatus;
  confidence: number; // 0-100
  tags: string[];
  extractedFields: Record<string, string | number | null>;
  relatedContactIds: ID[];
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
}

export type OutreachStatus =
  | "not_contacted"
  | "queued"
  | "contacted"
  | "replied"
  | "bounced"
  | "do_not_contact";

export interface Contact {
  id: ID;
  workspaceId: ID;
  projectId?: ID;
  name: string;
  organization?: string;
  role?: string;
  email?: string;
  phone?: string;
  website?: string;
  social?: { linkedin?: string; twitter?: string; instagram?: string };
  source: string;
  confidence: number;
  outreachStatus: OutreachStatus;
  notes?: string;
  createdAt: string;
}

export type RunStatus = "queued" | "running" | "success" | "partial" | "failed" | "cancelled";

export interface Run {
  id: ID;
  workspaceId: ID;
  projectId: ID;
  type: string; // e.g. "scrape", "enrich", "search"
  sourceId?: ID;
  sourceLabel?: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  recordsFound: number;
  contactsFound: number;
  errorsCount: number;
  logs?: string[];
}

export type SourceHealth = "healthy" | "degraded" | "down" | "unknown";

export interface Source {
  id: ID;
  workspaceId: ID;
  name: string;
  type: SourceType;
  url?: string;
  health: SourceHealth;
  lastRunAt?: string;
  recordsProduced: number;
  notes?: string;
}

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface SystemError {
  id: ID;
  workspaceId: ID;
  runId?: ID;
  projectId?: ID;
  sourceId?: ID;
  message: string;
  severity: ErrorSeverity;
  category: "scrape" | "parse" | "missing_field" | "low_confidence" | "network" | "auth" | "other";
  createdAt: string;
  resolved: boolean;
}

export interface Tag {
  id: ID;
  label: string;
  color: string; // hsl token name suffix or full token
}

export interface Note {
  id: ID;
  entityType: "project" | "finding" | "contact" | "run";
  entityId: ID;
  author: string;
  body: string;
  createdAt: string;
}
