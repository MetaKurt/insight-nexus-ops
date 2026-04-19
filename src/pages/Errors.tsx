import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Errors() {
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");

  const { data: errors = [], isLoading } = useQuery({
    queryKey: ["errors", workspaceId],
    queryFn: () => api.errors.list(workspaceId),
  });
  const { data: findings = [] } = useQuery({
    queryKey: ["findings", workspaceId],
    queryFn: () => api.findings.list(workspaceId),
  });

  const filtered = useMemo(() => errors.filter((e) => {
    if (severity !== "all" && e.severity !== severity) return false;
    if (search && !e.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [errors, severity, search]);

  const counts = {
    failed: errors.filter((e) => e.severity === "critical" || e.severity === "high").length,
    lowConf: findings.filter((f) => f.confidence < 50).length,
    missing: errors.filter((e) => e.category === "missing_field").length,
    retry: errors.filter((e) => !e.resolved).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System health"
        title="Errors"
        description="Operational visibility into failures, missing fields, and low-confidence records."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="High / critical" value={counts.failed} icon={AlertTriangle} />
        <StatCard label="Low confidence" value={counts.lowConf} hint="Below 50%" />
        <StatCard label="Missing fields" value={counts.missing} />
        <StatCard label="Retry needed" value={counts.retry} />
      </div>

      <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Search error messages…">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No errors match" description="Everything is healthy." />
      ) : (
        <Card className="border-border/60 bg-surface-elevated overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Message</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Run</TableHead>
                <TableHead>When</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.message}</TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">{e.category.replace(/_/g, " ")}</TableCell>
                  <TableCell><StatusBadge status={e.severity} /></TableCell>
                  <TableCell className="font-mono text-xs">{e.runId ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => toast.success("Retry queued (mock)")}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
