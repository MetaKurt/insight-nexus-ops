import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, RefreshCw, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { jobTypeCatalog } from "@/mocks/jobs";
import type { Job } from "@/types/jobs";
import { Inbox } from "lucide-react";

const labelFor = (typeId: string) =>
  jobTypeCatalog.find((d) => d.id === typeId)?.label ?? typeId;

const fmtRelative = (iso?: string) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

const fmtDuration = (ms?: number) => {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

interface JobsTableProps {
  jobs: Job[];
  variant: "active" | "history";
  emptyTitle?: string;
  emptyDescription?: string;
}

export function JobsTable({ jobs, variant, emptyTitle, emptyDescription }: JobsTableProps) {
  const qc = useQueryClient();

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.jobs.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job cancelled");
    },
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => api.jobs.retry(id),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Retry queued", { description: job ? `New job ${job.id}` : undefined });
    },
  });

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={emptyTitle ?? "No jobs yet"}
        description={emptyDescription ?? "Launch a job above to get started."}
      />
    );
  }

  return (
    <Card className="overflow-hidden border-border/60 bg-surface-elevated">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Job</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            {variant === "active" ? (
              <>
                <TableHead>Worker</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </>
            ) : (
              <>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead className="text-right">Completed</TableHead>
              </>
            )}
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow key={j.id}>
              <TableCell>
                <Link to={`/control-center/jobs/${j.id}`} className="font-mono text-xs font-medium hover:text-primary">
                  {j.id}
                </Link>
              </TableCell>
              <TableCell className="text-sm">{labelFor(j.type)}</TableCell>
              <TableCell><StatusBadge status={j.status} /></TableCell>
              <TableCell><StatusBadge status={j.priority} /></TableCell>
              {variant === "active" ? (
                <>
                  <TableCell className="text-xs text-muted-foreground">{j.workerName ?? "—"}</TableCell>
                  <TableCell className="text-xs">{j.requestedBy}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{fmtRelative(j.createdAt)}</TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">{j.recordsCreated ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {j.errorsCount && j.errorsCount > 0 ? <span className="text-destructive">{j.errorsCount}</span> : "0"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtDuration(j.durationMs)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{j.workerName ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{fmtRelative(j.completedAt)}</TableCell>
                </>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/control-center/jobs/${j.id}`}>
                        <Eye className="mr-2 h-4 w-4" /> View
                      </Link>
                    </DropdownMenuItem>
                    {(j.status === "queued" || j.status === "running") && (
                      <DropdownMenuItem onClick={() => cancelMut.mutate(j.id)}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                      </DropdownMenuItem>
                    )}
                    {(j.status === "failed" || j.status === "cancelled" || j.status === "succeeded") && (
                      <DropdownMenuItem onClick={() => retryMut.mutate(j.id)}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Retry
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
