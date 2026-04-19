import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Database,
  FolderKanban,
  PlayCircle,
  Users,
  ArrowUpRight,
  Building2,
  Mic,
  Sparkles,
  Briefcase,
  Compass,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { Vertical } from "@/types";

const verticalMeta: Record<Vertical, { label: string; icon: typeof Building2; tint: string }> = {
  hotels: { label: "Hotels", icon: Building2, tint: "from-emerald-500/20" },
  tedx: { label: "TEDx", icon: Mic, tint: "from-rose-500/20" },
  nvrland: { label: "NVRLand", icon: Sparkles, tint: "from-violet-500/20" },
  clients: { label: "Clients", icon: Briefcase, tint: "from-amber-500/20" },
  general: { label: "General Research", icon: Compass, tint: "from-sky-500/20" },
};

export default function Dashboard() {
  const { workspaceId, workspaces } = useWorkspace();

  const { data: projects = [], isLoading: lp } = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => api.projects.list(workspaceId),
  });
  const { data: findings = [], isLoading: lf } = useQuery({
    queryKey: ["findings", workspaceId],
    queryFn: () => api.findings.list(workspaceId),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", workspaceId],
    queryFn: () => api.contacts.list(workspaceId),
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["runs", workspaceId],
    queryFn: () => api.runs.list(workspaceId),
  });
  const { data: errors = [] } = useQuery({
    queryKey: ["errors", workspaceId],
    queryFn: () => api.errors.list(workspaceId),
  });

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const todayRuns = runs.filter((r) => Date.now() - new Date(r.startedAt).getTime() < 86400000).length;
  const failedRuns = runs.filter((r) => r.status === "failed");
  const recentRuns = [...runs].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)).slice(0, 6);
  const recentContacts = [...contacts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);

  // Records-by-vertical counts
  const verticalCounts: Record<Vertical, number> = { hotels: 0, tedx: 0, nvrland: 0, clients: 0, general: 0 };
  findings.forEach((f) => {
    const w = workspaces.find((w) => w.id === f.workspaceId);
    if (w) verticalCounts[w.vertical] += 1;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Mission Control"
        description="A live snapshot of every research run, finding, and contact across your workspaces."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/runs">View runs</Link>
            </Button>
            <Button asChild>
              <Link to="/review">Open review queue</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total records" value={lf ? "…" : findings.length} icon={Database} delta={{ value: "+12% wk", positive: true }} />
        <StatCard label="Active projects" value={lp ? "…" : activeProjects} icon={FolderKanban} hint={`${projects.length} total`} />
        <StatCard label="Contacts found" value={contacts.length} icon={Users} delta={{ value: "+8 today", positive: true }} />
        <StatCard label="Jobs today" value={todayRuns} icon={PlayCircle} hint={`${runs.length} all-time`} />
        <StatCard label="Errors" value={errors.length} icon={AlertTriangle} delta={{ value: `${failedRuns.length} failed runs`, positive: false }} />
      </div>

      {/* Vertical breakdown */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">By vertical</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(verticalMeta) as Vertical[]).map((v) => {
            const meta = verticalMeta[v];
            const Icon = meta.icon;
            return (
              <Card key={v} className="relative overflow-hidden border-border/60 bg-surface-elevated">
                <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${meta.tint} to-transparent blur-2xl`} />
                <CardContent className="relative p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">{meta.label}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{verticalCounts[v]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">records collected</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent runs */}
        <Card className="lg:col-span-2 bg-surface-elevated border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent runs</CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
              <Link to="/runs">All runs <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {recentRuns.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No runs yet.</div>
              ) : (
                recentRuns.map((r) => (
                  <Link key={r.id} to={`/runs/${r.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/30">
                    <div className="rounded-md bg-muted p-2 text-muted-foreground">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.sourceLabel ?? r.type}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.type} · {new Date(r.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="hidden text-right text-xs text-muted-foreground md:block">
                      <span className="tabular-nums">{r.recordsFound}</span> records
                    </div>
                    <StatusBadge status={r.status} />
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent contacts */}
        <Card className="bg-surface-elevated border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent contacts</CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
              <Link to="/contacts">All <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {recentContacts.map((c) => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.role} · {c.organization}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Failed jobs strip */}
      {failedRuns.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-md bg-destructive/15 p-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{failedRuns.length} failed run{failedRuns.length === 1 ? "" : "s"} need attention</p>
              <p className="text-xs text-muted-foreground">Investigate logs and retry once the source recovers.</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/errors">Investigate</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {(lp || lf) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
    </div>
  );
}
