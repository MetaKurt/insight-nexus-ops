// Pure mapping helpers between our TypeScript Job model and the
// Supabase `jobs` / `job_logs` / `workers` table rows. Kept separate from
// the API layer so the same mapping is used by queries, mutations,
// and Realtime subscriptions.

import type { Tables } from "@/integrations/supabase/types";
import type {
  Job,
  JobLog,
  JobPriority,
  JobStatus,
  JobTimelineEvent,
  Worker,
  WorkerStatus,
} from "@/types/jobs";

type JobRow = Tables<"jobs">;
type JobLogRow = Tables<"job_logs">;
type WorkerRow = Tables<"workers">;

// ── Priority: TS enum  <->  integer column ─────────────────────────────
// 1 = low, 5 = normal, 8 = high, 10 = urgent
export const priorityToInt = (p: JobPriority): number =>
  ({ low: 1, normal: 5, high: 8, urgent: 10 }[p]);

export const intToPriority = (n: number | null | undefined): JobPriority => {
  const v = n ?? 5;
  if (v >= 10) return "urgent";
  if (v >= 8) return "high";
  if (v <= 1) return "low";
  return "normal";
};

const VALID_STATUSES: JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
];

const asJobStatus = (s: string | null | undefined): JobStatus =>
  VALID_STATUSES.includes(s as JobStatus) ? (s as JobStatus) : "queued";

const VALID_WORKER_STATUSES: WorkerStatus[] = [
  "online",
  "busy",
  "idle",
  "offline",
  "degraded",
];

const asWorkerStatus = (s: string | null | undefined): WorkerStatus =>
  VALID_WORKER_STATUSES.includes(s as WorkerStatus)
    ? (s as WorkerStatus)
    : "offline";

// ── Job row → Job ──────────────────────────────────────────────────────
export const rowToJob = (row: JobRow, workerName?: string | null): Job => {
  const timeline: JobTimelineEvent[] = [
    { at: row.created_at, status: "created", message: "Job request created" },
  ];
  if (row.started_at) {
    timeline.push({
      at: row.started_at,
      status: "running",
      message: workerName ? `Picked up by ${workerName}` : "Worker picked up job",
    });
  }
  if (row.completed_at && (row.status === "succeeded" || row.status === "failed")) {
    timeline.push({
      at: row.completed_at,
      status: asJobStatus(row.status),
      message: row.status === "succeeded" ? "Completed successfully" : "Job failed",
    });
  }
  if (row.cancelled_at) {
    timeline.push({
      at: row.cancelled_at,
      status: "cancelled",
      message: "Cancelled",
    });
  }

  const durationMs =
    row.started_at && (row.completed_at || row.cancelled_at)
      ? new Date((row.completed_at ?? row.cancelled_at) as string).getTime() -
        new Date(row.started_at).getTime()
      : undefined;

  // The Supabase `jobs` table has no workspace_id; we keep the Job.workspaceId
  // field for type compatibility but use the project_id (or "default") so the
  // existing workspace filter in the UI doesn't hide rows.
  const workspaceId = row.project_id ?? "default";

  // Heuristic result/error summary pulled from the notes column.
  const isError = row.status === "failed";

  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Job["payload"])
      : {};

  return {
    id: row.id,
    workspaceId,
    projectId: row.project_id ?? undefined,
    type: row.job_type as Job["type"],
    status: asJobStatus(row.status),
    priority: intToPriority(row.priority),
    payload,
    requestedBy: row.requested_by ?? "system",
    workerId: row.worker_id ?? undefined,
    workerName: workerName ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? row.cancelled_at ?? undefined,
    durationMs,
    recordsCreated: row.records_created ?? 0,
    errorsCount: row.errors_count ?? 0,
    resultSummary: !isError && row.notes ? row.notes : undefined,
    errorSummary: isError && row.notes ? row.notes : undefined,
    timeline,
  };
};

// ── JobLog row → JobLog ────────────────────────────────────────────────
export const rowToLog = (row: JobLogRow): JobLog => ({
  id: String(row.id),
  jobId: row.job_id,
  workerId: row.worker_id ?? undefined,
  level: (row.level as JobLog["level"]) ?? "info",
  message: row.message,
  at: row.created_at,
});

// ── Worker row → Worker ────────────────────────────────────────────────
export const rowToWorker = (row: WorkerRow, currentJobLabel?: string): Worker => {
  // Derive a friendlier status if heartbeat is stale (>2 min => offline,
  // >30s while supposedly idle/online => degraded).
  const heartbeat = row.last_heartbeat ? new Date(row.last_heartbeat).getTime() : 0;
  const ageMs = heartbeat ? Date.now() - heartbeat : Number.POSITIVE_INFINITY;
  let status = asWorkerStatus(row.status);
  if (ageMs > 2 * 60_000) status = "offline";
  else if (ageMs > 30_000 && (status === "idle" || status === "online")) status = "degraded";

  return {
    id: row.id,
    name: row.machine_name,
    status,
    environment: (row.environment as Worker["environment"]) ?? "production",
    version: row.version ?? "unknown",
    lastHeartbeatAt: row.last_heartbeat ?? row.updated_at,
    currentJobId: row.current_job_id ?? undefined,
    currentJobLabel,
  };
};
