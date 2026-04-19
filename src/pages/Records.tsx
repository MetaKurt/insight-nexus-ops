import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Database, Download, Tag as TagIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TagChip } from "@/components/TagChip";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const statuses = ["all", "new", "in_review", "approved", "rejected", "flagged", "duplicate", "complete"];
const sourceTypes = ["all", "website", "event_page", "social", "directory", "manual", "csv", "api"];

export default function Records() {
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sourceType, setSourceType] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["findings", workspaceId],
    queryFn: () => api.findings.list(workspaceId),
  });

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (status !== "all" && f.status !== status) return false;
      if (sourceType !== "all" && f.sourceType !== sourceType) return false;
      if (search && ![f.title, f.summary, ...f.tags].join(" ").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [findings, status, sourceType, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () =>
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((f) => f.id)));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Findings"
        title="Records"
        description="Every result collected by your scraping, enrichment, and research pipelines."
        actions={
          <Button variant="outline" onClick={() => toast.success("Export queued (mock)")}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        }
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Search title, summary, tag…">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{sourceTypes.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
      </FilterBar>

      {selected.size > 0 && (
        <Card className="flex items-center justify-between gap-3 border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium"><span className="text-primary">{selected.size}</span> selected</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast.success(`Tagged ${selected.size} (mock)`)}>
              <TagIcon className="mr-1.5 h-3.5 w-3.5" /> Tag
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.success(`Marked ${selected.size} complete (mock)`)}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark complete
            </Button>
            <Button size="sm" onClick={() => toast.success(`Exported ${selected.size} (mock)`)}>Export</Button>
          </div>
        </Card>
      )}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState icon={Database} title="No records match" description="Adjust filters or run a job to collect new findings." />
      ) : (
        <Card className="border-border/60 bg-surface-elevated overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={f.id} className="group">
                  <TableCell><Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} /></TableCell>
                  <TableCell className="max-w-md">
                    <Link to={`/records/${f.id}`} className="font-medium hover:text-primary">
                      {f.title}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{f.summary}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">{f.sourceType.replace(/_/g, " ")}</TableCell>
                  <TableCell><StatusBadge status={f.status} /></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{f.tags.map((t) => <TagChip key={t} label={t} />)}</div></TableCell>
                  <TableCell><ConfidenceMeter value={f.confidence} /></TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {new Date(f.createdAt).toLocaleDateString()}
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
