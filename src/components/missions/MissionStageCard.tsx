// Visual card for a single mission stage on the detail page.
// Shows status, dependency, payload preview, and the right action button:
//   - pending + no dep (or dep done) → "Queue now"
//   - awaiting_review                → "Approve & continue"
//   - everything else                → just status

import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, PlayCircle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import type { MissionStage } from "@/types/missions";
import { jobTypeCatalog } from "@/mocks/jobs";

// Worker agents currently registered in worker/signalhub_worker/registry.py.
// Keep in sync. If a stage's job_type isn't here, queueing produces a job
// no worker can claim — show a warning before the user clicks Approve.
const REGISTERED_AGENTS = new Set<string>(["hello", "tedx_scrape", "client_enrichment"]);

interface Props {
  stage: MissionStage;
  index: number;
  upstream?: MissionStage;
  canQueue: boolean;
  onQueue: () => void;
  onApprove: () => void;
  onRerun?: () => void;
  busy: boolean;
}

export function MissionStageCard({
  stage,
  index,
  upstream,
  canQueue,
  onQueue,
  onApprove,
  busy,
}: Props) {
  const jobTypeLabel =
    jobTypeCatalog.find((t) => t.id === stage.job_type)?.label ?? stage.job_type;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {index + 1}
            </span>
            <span className="font-medium">{jobTypeLabel}</span>
            {upstream && (
              <span className="flex items-center gap-1 text-[11px]">
                <ArrowRight className="h-3 w-3" />
                after “{upstream.name}”
              </span>
            )}
            {!stage.requires_review && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">auto-approve</span>
            )}
          </div>
          <h4 className="mt-1 truncate text-sm font-semibold">{stage.name}</h4>
          {stage.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{stage.description}</p>
          )}
        </div>
        <StatusBadge status={stage.status} />
      </div>

      {Object.keys(stage.payload ?? {}).length > 0 && (
        <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[11px] font-mono text-muted-foreground">
          {JSON.stringify(stage.payload, null, 2)}
        </pre>
      )}

      {!REGISTERED_AGENTS.has(stage.job_type) && stage.status !== "done" && stage.status !== "skipped" && (
        <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <div className="text-foreground">
            No worker agent registered for <code className="font-mono">{stage.job_type}</code>.
            Queueing or approving this stage will create a job that no worker can run yet.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {stage.job_id && (
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link to={`/control-center/jobs/${stage.job_id}`}>
              <ExternalLink className="mr-1 h-3 w-3" /> View job
            </Link>
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {stage.status === "pending" && (
            <Button size="sm" onClick={onQueue} disabled={!canQueue || busy}>
              <PlayCircle className="mr-1 h-3.5 w-3.5" />
              {canQueue ? "Queue now" : "Waiting on upstream"}
            </Button>
          )}
          {stage.status === "awaiting_review" && (
            <Button size="sm" onClick={onApprove} disabled={busy}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve & continue
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
