import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TagChip } from "@/components/TagChip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const { data: project, isLoading } = useQuery({ queryKey: ["project", id], queryFn: () => api.projects.get(id) });
  const { data: findings = [] } = useQuery({ queryKey: ["findings"], queryFn: () => api.findings.list("all") });
  const { data: contacts = [] } = useQuery({ queryKey: ["contacts"], queryFn: () => api.contacts.list("all") });
  const { data: runs = [] } = useQuery({ queryKey: ["runs"], queryFn: () => api.runs.list("all") });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!project) return <EmptyState icon={FolderKanban} title="Project not found" />;

  const projFindings = findings.filter((f) => f.projectId === project.id);
  const projContacts = contacts.filter((c) => c.projectId === project.id);
  const projRuns = runs.filter((r) => r.projectId === project.id);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Back to projects</Link>
      </Button>

      <PageHeader
        eyebrow="Project"
        title={project.name}
        description={project.description}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("Action wired to backend later")}>Edit</Button>
            <Button onClick={() => toast.success("New run queued (mock)")}>Start run</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        {project.tags.map((t) => <TagChip key={t} label={t} />)}
        <span className="text-xs text-muted-foreground">Owner · {project.owner}</span>
        <span className="text-xs text-muted-foreground">· Updated {new Date(project.updatedAt).toLocaleString()}</span>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="records">Records ({projFindings.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({projContacts.length})</TabsTrigger>
          <TabsTrigger value="runs">Runs ({projRuns.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-surface-elevated border-border/60"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Records</p><p className="mt-2 text-3xl font-semibold tabular-nums">{project.recordsCount}</p></CardContent></Card>
            <Card className="bg-surface-elevated border-border/60"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Contacts</p><p className="mt-2 text-3xl font-semibold tabular-nums">{project.contactsCount}</p></CardContent></Card>
            <Card className="bg-surface-elevated border-border/60"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Notes</p><p className="mt-2 text-3xl font-semibold tabular-nums">{project.notesCount}</p></CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="records">
          <Card className="bg-surface-elevated border-border/60">
            <CardHeader><CardTitle className="text-base">Linked records</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {projFindings.slice(0, 10).map((f) => (
                <Link key={f.id} to={`/records/${f.id}`} className="flex items-center justify-between rounded-md border border-border/60 p-3 hover:border-primary/40">
                  <span className="truncate text-sm font-medium">{f.title}</span>
                  <StatusBadge status={f.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="contacts">
          <Card className="bg-surface-elevated border-border/60">
            <CardContent className="space-y-2 p-5">
              {projContacts.slice(0, 10).map((c) => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center justify-between rounded-md border border-border/60 p-3 hover:border-primary/40">
                  <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.role} · {c.organization}</p></div>
                  <StatusBadge status={c.outreachStatus} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="runs">
          <Card className="bg-surface-elevated border-border/60">
            <CardContent className="space-y-2 p-5">
              {projRuns.map((r) => (
                <Link key={r.id} to={`/runs/${r.id}`} className="flex items-center justify-between rounded-md border border-border/60 p-3 hover:border-primary/40">
                  <div><p className="text-sm font-medium">{r.sourceLabel}</p><p className="text-xs text-muted-foreground">{r.type} · {new Date(r.startedAt).toLocaleString()}</p></div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notes">
          <EmptyState title="No notes yet" description="Capture context, decisions, or outreach details here." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
