// API service layer — currently returns mock data, but signatures match what
// Supabase queries will look like once the backend is connected.

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
import { jobLogs as mockJobLogs, jobs as mockJobs, workers as mockWorkers } from "@/mocks/jobs";

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
    list: (workspaceId?: string | null): Promise<Finding[]> =>
      delay(filterByWorkspace(mockFindings, workspaceId)),
    get: (id: string): Promise<Finding | undefined> =>
      delay(mockFindings.find((f) => f.id === id)),
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
  // ── Control Center ────────────────────────────────────────────────────
  // These mock methods mirror the shape of the future Supabase queries:
  //   jobs:    select/insert/update on `jobs` table
  //   logs:    select on `job_logs` table joined to a job
  //   workers: select on `workers` table (heartbeat-driven)
  jobs: {
    list: (workspaceId?: string | null): Promise<Job[]> =>
      delay(filterByWorkspace(mockJobs, workspaceId)),
    get: (id: string): Promise<Job | undefined> =>
      delay(mockJobs.find((j) => j.id === id)),
    create: (input: {
      workspaceId: string;
      projectId?: string;
      type: JobType;
      priority: JobPriority;
      payload: JobPayload;
      requestedBy: string;
    }): Promise<Job> => {
      const job: Job = {
        id: `j-${Math.floor(Math.random() * 9000 + 1000)}`,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        type: input.type,
        status: "queued",
        priority: input.priority,
        payload: input.payload,
        requestedBy: input.requestedBy,
        createdAt: new Date().toISOString(),
        timeline: [{ at: new Date().toISOString(), status: "created", message: "Job request created" }],
      };
      mockJobs.unshift(job);
      return delay(job, 200);
    },
    cancel: (id: string): Promise<void> => {
      const j = mockJobs.find((x) => x.id === id);
      if (j && (j.status === "queued" || j.status === "running")) {
        j.status = "cancelled";
        j.completedAt = new Date().toISOString();
        j.timeline.push({ at: j.completedAt, status: "cancelled", message: "Cancelled by user" });
      }
      return delay(undefined, 150);
    },
    retry: (id: string): Promise<Job | undefined> => {
      const j = mockJobs.find((x) => x.id === id);
      if (!j) return delay(undefined);
      const clone: Job = {
        ...j,
        id: `j-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: "queued",
        startedAt: undefined,
        completedAt: undefined,
        durationMs: undefined,
        recordsCreated: undefined,
        errorsCount: undefined,
        resultSummary: undefined,
        errorSummary: undefined,
        workerId: undefined,
        workerName: undefined,
        createdAt: new Date().toISOString(),
        timeline: [{ at: new Date().toISOString(), status: "created", message: `Retry of ${j.id}` }],
      };
      mockJobs.unshift(clone);
      return delay(clone, 200);
    },
  },
  jobLogs: {
    listForJob: (jobId: string): Promise<JobLog[]> =>
      delay(mockJobLogs.filter((l) => l.jobId === jobId)),
    listAll: (): Promise<JobLog[]> => delay(mockJobLogs),
  },
  workers: {
    list: (): Promise<Worker[]> => delay(mockWorkers),
  },
};
