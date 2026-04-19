// Control Center types — designed to map cleanly to backend tables:
// jobs, job_logs, workers. The frontend never executes commands itself;
// it only writes structured job requests that an external worker picks up.

import type { ID } from "./index";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobPriority = "low" | "normal" | "high" | "urgent";

export type JobType =
  | "hello"
  | "tedx_scrape"
  | "hotel_lead_research"
  | "nvrland_research"
  | "client_enrichment"
  | "email_lookup"
  | "retry_failed_records"
  | "refresh_source_scan"
  | "export_data";

export interface JobTypeDefinition {
  id: JobType;
  label: string;
  description: string;
  category: "research" | "enrichment" | "maintenance" | "export" | "diagnostic";
  defaultPriority: JobPriority;
  // Which payload fields this job type accepts in the launch form.
  fields: Array<
    | "projectId"
    | "sourceType"
    | "keywords"
    | "location"
    | "urls"
    | "limit"
    | "notes"
    | "country"
    | "years"
    | "availableOnly"
    | "maxPages"
    | "maxLookups"
    | "forceReenrich"
  >;
}

export interface JobPayload {
  projectId?: ID;
  sourceType?: string;
  keywords?: string;
  location?: string;
  urls?: string[];
  limit?: number;
  notes?: string;
  // tedx_scrape specific
  country?: string;
  years?: number[];
  available_only?: boolean;
  max_pages?: number;
  // email_lookup specific
  max_lookups?: number;
  force_reenrich?: boolean;
}

export interface JobTimelineEvent {
  at: string;
  status: JobStatus | "created" | "assigned";
  message?: string;
}

export interface Job {
  id: ID;
  workspaceId: ID;
  projectId?: ID;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: JobPayload;
  requestedBy: string;
  workerId?: ID;
  workerName?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  recordsCreated?: number;
  errorsCount?: number;
  resultSummary?: string;
  errorSummary?: string;
  relatedRunId?: ID;
  timeline: JobTimelineEvent[];
}

export type LogLevel = "debug" | "info" | "warning" | "error";

export interface JobLog {
  id: ID;
  jobId: ID;
  workerId?: ID;
  level: LogLevel;
  message: string;
  at: string;
}

export type WorkerStatus = "online" | "busy" | "idle" | "offline" | "degraded";

export interface Worker {
  id: ID;
  name: string;
  status: WorkerStatus;
  environment: "production" | "staging" | "local";
  version: string;
  lastHeartbeatAt: string;
  currentJobId?: ID;
  currentJobLabel?: string;
  cpuPct?: number;
  memPct?: number;
  region?: string;
}
