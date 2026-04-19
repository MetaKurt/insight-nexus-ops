import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export default function RunDetail() {
  const { id = "" } = useParams();
  const { data: r, isLoading } = useQuery({ queryKey: ["run", id], queryFn: () => api.runs.get(id) });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!r) return <EmptyState icon={PlayCircle} title="Run not found" />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/runs"><ArrowLeft className="mr-1 h-4 w-4" /> Back to runs</Link>
      </Button>

      <PageHeader
        eyebrow="Run"
        title={r.sourceLabel ?? r.type}
        description={`${r.type} · ${r.id}`}
        actions={
          <Button variant="outline" onClick={() => toast.success("Retry queued (mock)")}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={r.status} />
        <span className="text-xs text-muted-foreground">Started {new Date(r.startedAt).toLocaleString()}</span>
        {r.endedAt && <span className="text-xs text-muted-foreground">· Ended {new Date(r.endedAt).toLocaleString()}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-surface-elevated border-border/60"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Records</p><p className="mt-2 text-2xl font-semibold tabular-nums">{r.recordsFound}</p></CardContent></Card>
        <Card className="bg-surface-elevated border-border/60"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Contacts</p><p className="mt-2 text-2xl font-semibold tabular-nums">{r.contactsFound}</p></CardContent></Card>
        <Card className="bg-surface-elevated border-border/60"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Errors</p><p className="mt-2 text-2xl font-semibold tabular-nums text-destructive">{r.errorsCount}</p></CardContent></Card>
        <Card className="bg-surface-elevated border-border/60"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Duration</p><p className="mt-2 text-2xl font-semibold tabular-nums">{r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : "—"}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-surface-elevated border-border/60">
          <CardHeader><CardTitle className="text-base">Logs</CardTitle></CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-background p-4 font-mono text-xs leading-relaxed">
{(r.logs ?? []).map((line, i) => (
  <div key={i} className={line.includes("[ERROR]") ? "text-destructive" : line.includes("[WARN]") ? "text-warning" : "text-muted-foreground"}>{line}</div>
))}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border/60">
          <CardHeader><CardTitle className="text-base">Status timeline</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l border-border/60 pl-5 text-sm">
              <li className="relative">
                <span className="absolute -left-[26px] mt-1 h-2 w-2 rounded-full bg-info" />
                <p className="font-medium">Queued</p>
                <p className="text-xs text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[26px] mt-1 h-2 w-2 rounded-full bg-primary" />
                <p className="font-medium">Running</p>
              </li>
              {r.endedAt && (
                <li className="relative">
                  <span className={`absolute -left-[26px] mt-1 h-2 w-2 rounded-full ${r.status === "failed" ? "bg-destructive" : "bg-success"}`} />
                  <p className="font-medium capitalize">{r.status}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.endedAt).toLocaleString()}</p>
                </li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
