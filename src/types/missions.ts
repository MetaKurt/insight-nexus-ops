// Mission types — multi-stage research pipelines.
// A Mission groups N MissionStages. Each stage spawns a job_row when queued.

export type MissionStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type MissionStageStatus =
  | "pending"
  | "queued"
  | "running"
  | "awaiting_review"
  | "approved"
  | "done"
  | "failed"
  | "skipped";

export interface Mission {
  id: string;
  name: string;
  description: string | null;
  status: MissionStatus;
  project_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionStage {
  id: string;
  mission_id: string;
  order_index: number;
  name: string;
  description: string | null;
  job_type: string;
  payload: Record<string, unknown>;
  depends_on_stage_id: string | null;
  requires_review: boolean;
  status: MissionStageStatus;
  job_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Used by the create-mission form to draft stages before insert.
export interface DraftStage {
  name: string;
  description?: string;
  job_type: string;
  payload: Record<string, unknown>;
  requires_review: boolean;
  // Index of the stage this depends on (in the same draft array). null = none.
  depends_on_index: number | null;
}
