import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const fmtDuration = (ms?: number) => {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

export default function Runs() {
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["runs", workspaceId],
    queryFn: () => api.runs.list(workspaceId),
  });

  const filtered = useMemo(() => runs.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (search && ![r.id, r.type, r.sourceLabel].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [runs, status, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipelines"
        title="Runs"
        description="Every scraping, enrichment, and verification job tracked end-to-end."
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Search by run id, source, type…">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "queued", "running", "success", "partial", "failed", "cancelled"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState icon={PlayCircle} title="No runs match" />
      ) : (
        <Card className="border-border/60 bg-surface-elevated overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Run</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Link to={`/runs/${r.id}`} className="font-mono text-xs font-medium hover:text-primary">{r.id}</Link></TableCell>
                  <TableCell className="capitalize">{r.type}</TableCell>
                  <TableCell className="text-muted-foreground">{r.sourceLabel}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{r.recordsFound}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.contactsFound}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.errorsCount > 0 ? <span className="text-destructive">{r.errorsCount}</span> : "0"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtDuration(r.durationMs)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{new Date(r.startedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
