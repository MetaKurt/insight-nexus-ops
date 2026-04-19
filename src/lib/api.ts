// API service layer.
//
// Frontend-only resources (workspaces, projects, findings, contacts, runs,
// sources, errors, notes) still use mock data — those pages haven't been
// wired to Supabase yet.
//
// Control Center resources (jobs, job_logs, workers) are real:
//   - reads/writes go to Supabase tables of the same name
//   - workspace filtering is bypassed (the `jobs` table has no workspace_id)
//   - mutations are handled via SECURITY DEFINER RPCs where appropriate

import type {
  Contact,
  Finding,
  Note,
  Project,
  Run,
  Source,
  SystemError,
  Workspace,
} from "@/types";
import type { Job, JobLog, JobPayload, JobPriority, JobType, Worker } from "@/types/jobs";
import {
  contacts as mockContacts,
  errors as mockErrors,
  findings as mockFindings,
  notes as mockNotes,
  projects as mockProjects,
  runs as mockRuns,
  sources as mockSources,
  workspaces as mockWorkspaces,
} from "@/mocks/data";
import { supabase } from "@/integrations/supabase/client";
import { priorityToInt, rowToJob, rowToLog, rowToWorker } from "./jobsMapping";

// Maps a Supabase `findings` row → the UI `Finding` shape used by Records pages.
type FindingRow = {
  id: string;
  project_id: string | null;
  title: string | null;
  summary: string | null;
  source_url: string | null;
  source_type: string | null;
  status: string | null;
  confidence: number | null;
  data: unknown;
  created_at: string;
  updated_at: string;
};

function rowToFinding(r: FindingRow): Finding {
  const data = (r.data ?? {}) as Record<string, unknown>;
  const extracted: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) { extracted[k] = null; continue; }
    if (typeof v === "string" || typeof v === "number") extracted[k] = v;
    else if (typeof v === "boolean") extracted[k] = v ? "yes" : "no";
    else extracted[k] = JSON.stringify(v).slice(0, 200);
  }
  const knownTypes = new Set(["website", "event_page", "social", "directory", "manual", "csv", "api"]);
  const rawType = (r.source_type ?? "").toLowerCase();
  const sourceType = (knownTypes.has(rawType) ? rawType : "api") as Finding["sourceType"];
  // Confidence in DB is 0–1; UI expects 0–100.
  const cn = r.confidence == null ? 0 : Number(r.confidence);
  const conf = Math.round(cn <= 1 ? cn * 100 : cn);
  const tags: string[] = [];
  if (typeof data.event_type === "string") tags.push(data.event_type);
  if (typeof data.state === "string") tags.push(data.state);
  if (r.source_type) tags.push(r.source_type);
  return {
    id: r.id,
    workspaceId: "",
    projectId: r.project_id ?? "",
    title: r.title ?? "(untitled)",
    summary: r.summary ?? "",
    sourceUrl: r.source_url ?? "",
    sourceType,
    status: ((r.status ?? "new") as Finding["status"]),
    confidence: conf,
    tags,
    extractedFields: extracted,
    relatedContactIds: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const delay = <T,>(value: T, ms = 250): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const filterByWorkspace = <T extends { workspaceId: string }>(items: T[], workspaceId?: string | null) =>
  !workspaceId || workspaceId === "all" ? items : items.filter((i) => i.workspaceId === workspaceId);


export const api = {
  workspaces: {
    list: (): Promise<Workspace[]> => delay(mockWorkspaces),
  },
  projects: {
    list: (workspaceId?: string | null): Promise<Project[]> =>
      delay(filterByWorkspace(mockProjects, workspaceId)),
    get: (id: string): Promise<Project | undefined> =>
      delay(mockProjects.find((p) => p.id === id)),
  },
  findings: {
    // Live Supabase-backed findings. Maps DB row → UI Finding shape.
    list: async (_workspaceId?: string | null): Promise<Finding[]> => {
      const { data, error } = await supabase
        .from("findings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map(rowToFinding);
    },
    get: async (id: string): Promise<Finding | undefined> => {
      const { data, error } = await supabase
        .from("findings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToFinding(data) : undefined;
    },
  },
  contacts: {
    list: (workspaceId?: string | null): Promise<Contact[]> =>
      delay(filterByWorkspace(mockContacts, workspaceId)),
    get: (id: string): Promise<Contact | undefined> =>
      delay(mockContacts.find((c) => c.id === id)),
  },
  runs: {
    list: (workspaceId?: string | null): Promise<Run[]> =>
      delay(filterByWorkspace(mockRuns, workspaceId)),
    get: (id: string): Promise<Run | undefined> =>
      delay(mockRuns.find((r) => r.id === id)),
  },
  sources: {
    list: (workspaceId?: string | null): Promise<Source[]> =>
      delay(filterByWorkspace(mockSources, workspaceId)),
  },
  errors: {
    list: (workspaceId?: string | null): Promise<SystemError[]> =>
      delay(filterByWorkspace(mockErrors, workspaceId)),
  },
  notes: {
    listForEntity: (entityType: Note["entityType"], entityId: string): Promise<Note[]> =>
      delay(mockNotes.filter((n) => n.entityType === entityType && n.entityId === entityId)),
  },

  // ── Control Center (live Supabase) ────────────────────────────────────
  jobs: {
    list: async (_workspaceId?: string | null): Promise<Job[]> => {
      const { data: jobsData, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = jobsData ?? [];

      // Fetch the involved workers in one round-trip so we can show machine names.
      const workerIds = Array.from(new Set(rows.map((r) => r.worker_id).filter(Boolean) as string[]));
      let workerMap = new Map<string, string>();
      if (workerIds.length) {
        const { data: workers } = await supabase
          .from("workers")
          .select("id, machine_name")
          .in("id", workerIds);
        workerMap = new Map((workers ?? []).map((w) => [w.id, w.machine_name]));
      }
      return rows.map((r) => rowToJob(r, workerMap.get(r.worker_id ?? "")));
    },

    get: async (id: string): Promise<Job | undefined> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return undefined;
      let workerName: string | undefined;
      if (data.worker_id) {
        const { data: w } = await supabase
          .from("workers")
          .select("machine_name")
          .eq("id", data.worker_id)
          .maybeSingle();
        workerName = w?.machine_name ?? undefined;
      }
      return rowToJob(data, workerName);
    },

    create: async (input: {
      workspaceId: string;
      projectId?: string;
      type: JobType;
      priority: JobPriority;
      payload: JobPayload;
      requestedBy: string;
    }): Promise<Job> => {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          job_type: input.type,
          status: "queued",
          priority: priorityToInt(input.priority),
          project_id: input.projectId ?? null,
          payload: input.payload as never,
          requested_by: input.requestedBy,
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToJob(data);
    },

    cancel: async (id: string): Promise<void> => {
      // Use complete_job RPC so worker assignment is also released.
      const { error } = await supabase.rpc("complete_job", {
        p_job_id: id,
        p_status: "cancelled",
        p_records_created: 0,
        p_errors_count: 0,
        p_notes: "Cancelled by user from dashboard",
      });
      if (error) throw error;
    },

    retry: async (id: string): Promise<Job | undefined> => {
      const { data: orig, error: getErr } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (getErr) throw getErr;
      if (!orig) return undefined;

      const { data, error } = await supabase
        .from("jobs")
        .insert({
          job_type: orig.job_type,
          status: "queued",
          priority: orig.priority,
          project_id: orig.project_id,
          payload: orig.payload,
          requested_by: orig.requested_by ?? "retry",
          notes: `Retry of ${id}`,
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToJob(data);
    },
  },

  jobLogs: {
    listForJob: async (jobId: string): Promise<JobLog[]> => {
      const { data, error } = await supabase
        .from("job_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map(rowToLog);
    },

    listAll: async (): Promise<JobLog[]> => {
      const { data, error } = await supabase
        .from("job_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map(rowToLog);
    },
  },

  workers: {
    list: async (): Promise<Worker[]> => {
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .order("machine_name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((w) => rowToWorker(w));
    },
  },
};

