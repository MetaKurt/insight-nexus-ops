import { useQuery } from "@tanstack/react-query";
import { Cpu, MemoryStick, Server } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmtRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
};

const heartbeatTone = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "bg-success";
  if (diff < 5 * 60_000) return "bg-warning";
  return "bg-destructive";
};

export function WorkerStatusPanel() {
  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: () => api.workers.list(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (workers.length === 0) {
    return <EmptyState icon={Server} title="No workers registered" description="Workers will appear here once they send a heartbeat." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {workers.map((w) => (
        <Card key={w.id} className="border-border/60 bg-surface-elevated">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{w.name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {w.environment} · v{w.version}
                  </p>
                </div>
              </div>
              <StatusBadge status={w.status} />
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", heartbeatTone(w.lastHeartbeatAt))} />
              Heartbeat {fmtRelative(w.lastHeartbeatAt)}
              {w.region && <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px]">{w.region}</span>}
            </div>

            {(w.cpuPct !== undefined || w.memPct !== undefined) && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {w.cpuPct !== undefined && (
                  <div className="rounded-md bg-muted/40 px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-muted-foreground"><Cpu className="h-3 w-3" /> CPU</span>
                      <span className="tabular-nums">{w.cpuPct}%</span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded bg-background">
                      <div
                        className={cn("h-full", w.cpuPct > 80 ? "bg-destructive" : w.cpuPct > 60 ? "bg-warning" : "bg-primary")}
                        style={{ width: `${w.cpuPct}%` }}
                      />
                    </div>
                  </div>
                )}
                {w.memPct !== undefined && (
                  <div className="rounded-md bg-muted/40 px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-muted-foreground"><MemoryStick className="h-3 w-3" /> MEM</span>
                      <span className="tabular-nums">{w.memPct}%</span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded bg-background">
                      <div
                        className={cn("h-full", w.memPct > 80 ? "bg-destructive" : w.memPct > 60 ? "bg-warning" : "bg-primary")}
                        style={{ width: `${w.memPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">Current job: </span>
              {w.currentJobId ? (
                <span className="font-mono text-foreground">{w.currentJobId}</span>
              ) : (
                <span className="text-muted-foreground">idle</span>
              )}
              {w.currentJobLabel && <span className="text-muted-foreground"> — {w.currentJobLabel}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
