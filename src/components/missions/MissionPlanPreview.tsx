// Renders an LLM-proposed mission plan as a reviewable preview.
// "Create mission" inserts via missionsApi.create() and navigates to it.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { missionsApi } from "@/lib/missionsApi";
import { useAuth } from "@/hooks/useAuth";
import { jobTypeCatalog } from "@/mocks/jobs";
import type { DraftStage } from "@/types/missions";

export interface ProposedPlan {
  name: string;
  description?: string;
  stages: Array<{
    name: string;
    description?: string;
    job_type: string;
    payload: Record<string, unknown>;
    requires_review: boolean;
    depends_on_index: number | null;
  }>;
}

interface Props {
  plan: ProposedPlan;
  onCreated?: () => void;
}

export function MissionPlanPreview({ plan, onCreated }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const draftStages: DraftStage[] = plan.stages.map((s) => ({
        name: s.name,
        description: s.description,
        job_type: s.job_type,
        payload: s.payload ?? {},
        requires_review: s.requires_review,
        depends_on_index: s.depends_on_index,
      }));
      const mission = await missionsApi.create({
        name: plan.name,
        description: plan.description,
        created_by: user?.email ?? user?.id ?? null,
        stages: draftStages,
      });
      toast.success("Mission created");
      onCreated?.();
      navigate(`/missions/${mission.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create mission");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="space-y-4 border-primary/30 bg-primary/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Proposed mission
          </div>
          <h3 className="mt-1 text-lg font-semibold">{plan.name}</h3>
          {plan.description && (
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
          )}
        </div>
        <Button onClick={create} disabled={creating}>
          {creating ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
          )}
          Create mission
        </Button>
      </div>

      <div className="space-y-2">
        {plan.stages.map((s, i) => {
          const jobLabel =
            jobTypeCatalog.find((t) => t.id === s.job_type)?.label ?? s.job_type;
          return (
            <div
              key={i}
              className="rounded-md border border-border/60 bg-background/60 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="font-medium text-foreground">{s.name}</span>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {jobLabel}
                </Badge>
                {s.depends_on_index !== null && (
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    after stage {s.depends_on_index + 1}
                  </span>
                )}
                {s.requires_review ? (
                  <span className="ml-auto rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                    review gate
                  </span>
                ) : (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px]">
                    auto
                  </span>
                )}
              </div>
              {s.description && (
                <p className="mt-1.5 text-xs text-muted-foreground">{s.description}</p>
              )}
              {Object.keys(s.payload ?? {}).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-[11px] font-mono text-muted-foreground">
                  {JSON.stringify(s.payload, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
