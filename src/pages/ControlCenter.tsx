import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock4, ShieldCheck, XCircle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { StatCard } from "@/components/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { JobLaunchPanel } from "@/components/control-center/JobLaunchPanel";
import { JobsTable } from "@/components/control-center/JobsTable";
import { WorkerStatusPanel } from "@/components/control-center/WorkerStatusPanel";
import { LogStream } from "@/components/control-center/LogStream";
import { JournalTipCallout } from "@/components/control-center/JournalTipCallout";

import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { jobTypeCatalog } from "@/mocks/jobs";
import { useJobsRealtime } from "@/hooks/useJobsRealtime";

export default function ControlCenter() {
  useJobsRealtime();
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", workspaceId],
    queryFn: () => api.jobs.list(workspaceId),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["job-logs"],
    queryFn: () => api.jobLogs.listAll(),
  });

  const stats = useMemo(() => {
    const queued = jobs.filter((j) => j.status === "queued").length;
    const running = jobs.filter((j) => j.status === "running").length;
    const succeeded = jobs.filter((j) => j.status === "succeeded").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    return { queued, running, succeeded, failed };
  }, [jobs]);

  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");

  const history = useMemo(() => {
    return jobs
      .filter((j) => j.status === "succeeded" || j.status === "failed" || j.status === "cancelled")
      .filter((j) => (statusFilter === "all" ? true : j.status === statusFilter))
      .filter((j) => (typeFilter === "all" ? true : j.type === typeFilter))
      .filter((j) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          j.id.toLowerCase().includes(s) ||
          j.requestedBy.toLowerCase().includes(s) ||
          (j.workerName ?? "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobs, statusFilter, typeFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Control Center"
        description="Dispatch approved jobs to the worker fleet, monitor execution, and review results."
        actions={
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary"
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            Approved-actions only
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Queued" value={stats.queued} icon={Clock4} />
        <StatCard label="Running" value={stats.running} icon={Activity} hint="Live on worker fleet" />
        <StatCard label="Succeeded" value={stats.succeeded} icon={CheckCircle2} />
        <StatCard label="Failed" value={stats.failed} icon={XCircle} />
      </div>

      <JobLaunchPanel />

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Jobs <Badge variant="secondary" className="ml-2">{active.length}</Badge></TabsTrigger>
          <TabsTrigger value="history">Job History</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          <JobsTable
            jobs={active}
            variant="active"
            emptyTitle="Queue is clear"
            emptyDescription="No queued or running jobs. Launch one above."
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            placeholder="Search by job id, requester, worker…"
          >
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "succeeded", "failed", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All job types</SelectItem>
                {jobTypeCatalog.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBar>

          <JobsTable
            jobs={history}
            variant="history"
            emptyTitle="No jobs match"
            emptyDescription="Adjust your filters or run a new job."
          />
        </TabsContent>

        <TabsContent value="workers" className="space-y-3">
          <JournalTipCallout />
          <WorkerStatusPanel />
        </TabsContent>

        <TabsContent value="logs" className="space-y-3">
          <JournalTipCallout />
          <LogStream logs={logs} showJobLink emptyText="No logs across the fleet yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
