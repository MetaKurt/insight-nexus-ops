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
};
