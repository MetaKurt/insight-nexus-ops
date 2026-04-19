// Missions API — wraps Supabase calls for missions + mission_stages.
// Stage queueing/approval go through SECURITY DEFINER RPCs so the trigger
// chain (auto-queue downstream, mark mission complete) runs server-side.

import { supabase } from "@/integrations/supabase/client";
import type { DraftStage, Mission, MissionStage } from "@/types/missions";

export const missionsApi = {
  async list(): Promise<Mission[]> {
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Mission[];
  },

  async get(id: string): Promise<Mission | null> {
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Mission | null;
  },

  async listStages(missionId: string): Promise<MissionStage[]> {
    const { data, error } = await supabase
      .from("mission_stages")
      .select("*")
      .eq("mission_id", missionId)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as MissionStage[];
  },

  // Create a mission + its stages atomically-ish (two inserts).
  // Stage dependencies are resolved by index → real id after the stage insert.
  async create(args: {
    name: string;
    description?: string;
    project_id?: string | null;
    created_by?: string | null;
    stages: DraftStage[];
  }): Promise<Mission> {
    const { data: mission, error: mErr } = await supabase
      .from("missions")
      .insert({
        name: args.name,
        description: args.description ?? null,
        project_id: args.project_id ?? null,
        created_by: args.created_by ?? null,
        status: "draft",
      })
      .select("*")
      .single();
    if (mErr) throw mErr;

    if (args.stages.length === 0) return mission as Mission;

    // Insert stages WITHOUT depends_on first to get ids, then patch dependencies.
    const stageRows = args.stages.map((s, i) => ({
      mission_id: mission.id,
      order_index: i,
      name: s.name,
      description: s.description ?? null,
      job_type: s.job_type,
      payload: s.payload as never,
      requires_review: s.requires_review,
      status: "pending" as const,
    }));

    const { data: insertedStages, error: sErr } = await supabase
      .from("mission_stages")
      .insert(stageRows)
      .select("id, order_index");
    if (sErr) throw sErr;

    const idByIndex = new Map<number, string>(
      (insertedStages ?? []).map((r) => [r.order_index as number, r.id as string]),
    );

    // Patch depends_on_stage_id for stages that reference another by index.
    const patches = args.stages
      .map((s, i) => ({ i, dep: s.depends_on_index }))
      .filter((p) => p.dep !== null && idByIndex.has(p.dep!));

    for (const p of patches) {
      const stageId = idByIndex.get(p.i);
      const depId = idByIndex.get(p.dep!);
      if (!stageId || !depId) continue;
      const { error } = await supabase
        .from("mission_stages")
        .update({ depends_on_stage_id: depId })
        .eq("id", stageId);
      if (error) throw error;
    }

    return mission as Mission;
  },

  async queueStage(stageId: string) {
    const { data, error } = await supabase.rpc("queue_mission_stage", {
      p_stage_id: stageId,
    });
    if (error) throw error;
    return data;
  },

  async approveStage(stageId: string, approver?: string) {
    const { data, error } = await supabase.rpc("approve_mission_stage", {
      p_stage_id: stageId,
      p_approver: approver ?? null,
    });
    if (error) throw error;
    return data;
  },

  async deleteMission(id: string) {
    const { error } = await supabase.from("missions").delete().eq("id", id);
    if (error) throw error;
  },
};
