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
  { id: "ws-signalhub", name: "SignalHub", vertical: "tedx" },
];

export const tags: Tag[] = [
  { id: "t-event", label: "event", color: "info" },
  { id: "t-speaker", label: "speaker", color: "primary" },
  { id: "t-priority", label: "priority", color: "destructive" },
  { id: "t-followup", label: "follow-up", color: "warning" },
];

export const projects: Project[] = [];
export const sources: Source[] = [];
export const findings: Finding[] = [];
export const contacts: Contact[] = [];
export const runs: Run[] = [];
export const errors: SystemError[] = [];
export const notes: Note[] = [];
