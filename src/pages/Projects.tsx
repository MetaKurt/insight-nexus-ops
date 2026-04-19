import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FolderPlus, FolderKanban, Database, Users, FileText, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TagChip } from "@/components/TagChip";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Projects() {
  const { workspaceId, workspaces } = useWorkspace();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => api.projects.list(workspaceId),
  });

  const filtered = projects.filter((p) =>
    [p.name, p.description, p.owner, ...p.tags].join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspaces"
        title="Projects"
        description="Each project is an isolated stream of research, scraping, and enrichment work."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><FolderPlus className="mr-1.5 h-4 w-4" /> New project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>
                  Projects organize records, contacts, runs, and notes around a workflow.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="np-name">Name</Label>
                  <Input id="np-name" placeholder="e.g. Marriott Luxury Collection — EU" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-desc">Description</Label>
                  <Textarea id="np-desc" placeholder="What is this project trying to discover?" />
                </div>
                <div className="space-y-1.5">
                  <Label>Workspace</Label>
                  <Select defaultValue={workspaces[0]?.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {workspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => { toast.success("Project draft saved (mock)"); setOpen(false); }}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Search projects, owners, tags…">
        <div className="flex rounded-md border border-border bg-surface-elevated p-0.5">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"} size="sm" className="h-7 px-2"
            onClick={() => setView("grid")}
          ><LayoutGrid className="h-3.5 w-3.5" /></Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2"
            onClick={() => setView("list")}
          ><List className="h-3.5 w-3.5" /></Button>
        </div>
      </FilterBar>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects match"
          description="Try clearing filters or create a new project to get started."
          action={{ label: "New project", onClick: () => setOpen(true) }}
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="group h-full border-border/60 bg-surface-elevated transition-all hover:border-primary/40 hover:shadow-elegant">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold group-hover:text-primary">{p.name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => <TagChip key={t} label={t} />)}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/60 pt-4 text-center">
                    <div><p className="text-lg font-semibold tabular-nums">{p.recordsCount}</p><p className="text-[11px] text-muted-foreground">Records</p></div>
                    <div><p className="text-lg font-semibold tabular-nums">{p.contactsCount}</p><p className="text-[11px] text-muted-foreground">Contacts</p></div>
                    <div><p className="text-lg font-semibold tabular-nums">{p.notesCount}</p><p className="text-[11px] text-muted-foreground">Notes</p></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Owner · {p.owner}</span>
                    <span>Updated {new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-border/60 bg-surface-elevated">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell>
                    <Link to={`/projects/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link>
                  </TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>{p.owner}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.recordsCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.contactsCount}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(p.updatedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
