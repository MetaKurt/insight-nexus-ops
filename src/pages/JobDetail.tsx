import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  XCircle,
  ExternalLink,
  Server,
  CheckCircle2,
  AlertTriangle,
  Clock4,
  CircleDashed,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { LogStream } from "@/components/control-center/LogStream";
import { JobLaunchDialog } from "@/components/control-center/JobLaunchDialog";

import { api } from "@/lib/api";
import { jobTypeCatalog } from "@/mocks/jobs";
import { useState } from "react";
import type { JobTimelineEvent } from "@/types/jobs";
import { cn } from "@/lib/utils";

const labelFor = (id: string) =>
  jobTypeCatalog.find((d) => d.id === id)?.label ?? id;

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");

const timelineIcon = (status: JobTimelineEvent["status"]) => {
  switch (status) {
    case "succeeded": return CheckCircle2;
    case "failed": return AlertTriangle;
    case "running": return Clock4;
    case "assigned": return Server;
    case "cancelled": return XCircle;
    default: return CircleDashed;
  }
};

const timelineTone = (status: JobTimelineEvent["status"]) => {
  switch (status) {
    case "succeeded": return "text-success";
    case "failed": return "text-destructive";
    case "running": return "text-info";
    case "cancelled": return "text-muted-foreground";
    case "assigned": return "text-primary";
    default: return "text-muted-foreground";
  }
};

export default function JobDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.jobs.get(id),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["job-logs", id],
    queryFn: () => api.jobLogs.listForJob(id),
    enabled: Boolean(id),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.jobs.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job cancelled");
    },
  });

  const retryMut = useMutation({
    mutationFn: () => api.jobs.retry(id),
    onSuccess: (newJob) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Retry queued", { description: newJob ? `New job ${newJob.id}` : undefined });
      if (newJob) navigate(`/control-center/jobs/${newJob.id}`);
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/control-center"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        </Button>
        <Card className="border-border/60 bg-surface-elevated">
          <CardContent className="p-8 text-center text-muted-foreground">
            Job not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/control-center"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Control Center</Link>
      </Button>

      <PageHeader
        eyebrow={`Job · ${job.id}`}
        title={labelFor(job.type)}
        description={job.payload.notes || "Structured job request executed by the worker fleet."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            <StatusBadge status={job.priority} />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(job.status === "queued" || job.status === "running") && (
          <Button variant="outline" onClick={() => cancelMut.mutate()}>
            <XCircle className="mr-2 h-4 w-4" /> Cancel job
          </Button>
        )}
        <Button variant="outline" onClick={() => retryMut.mutate()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry job
        </Button>
        <Button variant="outline" onClick={() => setDuplicateOpen(true)}>
          <Copy className="mr-2 h-4 w-4" /> Duplicate
        </Button>
        {job.relatedRunId && (
          <Button variant="outline" asChild>
            <Link to={`/runs/${job.relatedRunId}`}>
              <ExternalLink className="mr-2 h-4 w-4" /> View related run
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-surface-elevated lg:col-span-2">
          <CardContent className="p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold">Metadata</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Requested by</dt>
                  <dd>{job.requestedBy}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Worker</dt>
                  <dd className="font-mono text-xs">{job.workerName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Project</dt>
                  <dd>
                    {job.projectId ? (
                      <Link to={`/projects/${job.projectId}`} className="text-primary hover:underline">
                        {job.projectId}
                      </Link>
                    ) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Created</dt>
                  <dd className="tabular-nums">{fmt(job.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Started</dt>
                  <dd className="tabular-nums">{fmt(job.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Completed</dt>
                  <dd className="tabular-nums">{fmt(job.completedAt)}</dd>
                </div>
              </dl>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Payload</h3>
              <pre className="mt-2 overflow-auto rounded-md border border-border/60 bg-background p-3 font-mono text-xs">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>

            {(job.resultSummary || job.errorSummary) && (
              <>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  {job.resultSummary && (
                    <div className="rounded-md border border-success/30 bg-success/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-success">Result</p>
                      <p className="mt-1 text-sm">{job.resultSummary}</p>
                      {job.recordsCreated !== undefined && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {job.recordsCreated} records created
                        </p>
                      )}
                    </div>
                  )}
                  {job.errorSummary && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Error</p>
                      <p className="mt-1 text-sm">{job.errorSummary}</p>
                      {job.errorsCount !== undefined && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {job.errorsCount} errors recorded
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface-elevated">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">Status timeline</h3>
            <ol className="mt-4 space-y-4">
              {job.timeline.map((ev, i) => {
                const Icon = timelineIcon(ev.status);
                return (
                  <li key={i} className="relative flex gap-3">
                    {i < job.timeline.length - 1 && (
                      <span className="absolute left-[11px] top-6 h-full w-px bg-border" />
                    )}
                    <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted", timelineTone(ev.status))}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm font-medium capitalize">{ev.status}</p>
                      {ev.message && <p className="text-xs text-muted-foreground">{ev.message}</p>}
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{fmt(ev.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-surface-elevated">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Log stream</h3>
            <Badge variant="outline" className="text-[10px]">{logs.length} entries</Badge>
          </div>
          <LogStream logs={logs} emptyText="No logs for this job yet." />
        </CardContent>
      </Card>

      <JobLaunchDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} defaultJobType={job.type} />
    </div>
  );
}
