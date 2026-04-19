// Mission detail page — shows the stage pipeline with queue/approve actions.
// Realtime: re-fetches when any mission_stages row changes for this mission.

import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MissionStageCard } from "@/components/missions/MissionStageCard";
import { missionsApi } from "@/lib/missionsApi";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: mission } = useQuery({
    queryKey: ["mission", id],
    queryFn: () => missionsApi.get(id!),
    enabled: !!id,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["mission-stages", id],
    queryFn: () => missionsApi.listStages(id!),
    enabled: !!id,
  });

  // Realtime: any update to this mission's stages or its jobs → refetch.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`mission-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_stages", filter: `mission_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["mission-stages", id] });
          qc.invalidateQueries({ queryKey: ["mission", id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        () => {
          qc.invalidateQueries({ queryKey: ["mission-stages", id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const queueStage = useMutation({
    mutationFn: (stageId: string) => missionsApi.queueStage(stageId),
    onSuccess: () => {
      toast.success("Stage queued");
      qc.invalidateQueries({ queryKey: ["mission-stages", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveStage = useMutation({
    mutationFn: (stageId: string) =>
      missionsApi.approveStage(stageId, user?.email ?? user?.id ?? undefined),
    onSuccess: () => {
      toast.success("Stage approved — downstream queued if any");
      qc.invalidateQueries({ queryKey: ["mission-stages", id] });
      qc.invalidateQueries({ queryKey: ["mission", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rerunStage = useMutation({
    mutationFn: (stageId: string) => missionsApi.rerunStage(stageId),
    onSuccess: () => {
      toast.success("Stage re-queued — new job created");
      qc.invalidateQueries({ queryKey: ["mission-stages", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMission = useMutation({
    mutationFn: () => missionsApi.deleteMission(id!),
    onSuccess: () => {
      toast.success("Mission deleted");
      qc.invalidateQueries({ queryKey: ["missions"] });
      navigate("/missions");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!mission) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/missions"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Loading mission…</p>
      </div>
    );
  }

  const stageById = new Map(stages.map((s) => [s.id, s]));

  // A stage can be queued if: status is pending AND (no dep, or dep is done).
  const canQueueStage = (stageId: string) => {
    const s = stageById.get(stageId);
    if (!s || s.status !== "pending") return false;
    if (!s.depends_on_stage_id) return true;
    const dep = stageById.get(s.depends_on_stage_id);
    return dep?.status === "done";
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/missions"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> All missions</Link>
      </Button>

      <PageHeader
        eyebrow="Mission"
        title={mission.name}
        description={mission.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={mission.status} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this mission?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All stages will be removed. Jobs already created will remain in the Control Center.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMission.mutate()}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="space-y-3">
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">This mission has no stages.</p>
        ) : (
          stages.map((stage, i) => (
            <MissionStageCard
              key={stage.id}
              stage={stage}
              index={i}
              upstream={stage.depends_on_stage_id ? stageById.get(stage.depends_on_stage_id) : undefined}
              canQueue={canQueueStage(stage.id)}
              onQueue={() => queueStage.mutate(stage.id)}
              onApprove={() => approveStage.mutate(stage.id)}
              onRerun={() => rerunStage.mutate(stage.id)}
              busy={queueStage.isPending || approveStage.isPending || rerunStage.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
