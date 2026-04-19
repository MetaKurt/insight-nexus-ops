import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Database, CheckCircle2, Tag as TagIcon, Download, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TagChip } from "@/components/TagChip";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export default function RecordDetail() {
  const { id = "" } = useParams();
  const { data: f, isLoading } = useQuery({ queryKey: ["finding", id], queryFn: () => api.findings.get(id) });
  const { data: project } = useQuery({
    queryKey: ["project", f?.projectId], queryFn: () => api.projects.get(f!.projectId), enabled: !!f,
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!f) return <EmptyState icon={Database} title="Record not found" />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/records"><ArrowLeft className="mr-1 h-4 w-4" /> Back to records</Link>
      </Button>

      <PageHeader
        eyebrow="Record"
        title={f.title}
        description={f.summary}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Tag dialog (mock)")}><TagIcon className="mr-1.5 h-4 w-4" /> Tag</Button>
            <Button variant="outline" onClick={() => toast.success("Assigned (mock)")}><UserPlus className="mr-1.5 h-4 w-4" /> Assign</Button>
            <Button variant="outline" onClick={() => toast.success("Exported (mock)")}><Download className="mr-1.5 h-4 w-4" /> Export</Button>
            <Button onClick={() => toast.success("Marked complete (mock)")}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark complete</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={f.status} />
        {f.tags.map((t) => <TagChip key={t} label={t} />)}
        <ConfidenceMeter value={f.confidence} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-surface-elevated border-border/60">
          <CardHeader><CardTitle className="text-base">Extracted fields</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
              {Object.entries(f.extractedFields).map(([k, v]) => (
                <div key={k} className="border-b border-border/40 pb-2">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 truncate font-medium">{v?.toString() ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border/60">
          <CardHeader><CardTitle className="text-base">Source</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Type</p>
              <p className="mt-0.5 capitalize">{f.sourceType.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">URL</p>
              <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 truncate text-primary hover:underline">
                {f.sourceUrl} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {project && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Project</p>
                <Link to={`/projects/${project.id}`} className="mt-0.5 block hover:text-primary">{project.name}</Link>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Created</p>
              <p className="mt-0.5">{new Date(f.createdAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface-elevated border-border/60">
        <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l border-border/60 pl-5">
            <li className="relative">
              <span className="absolute -left-[26px] mt-1 h-2 w-2 rounded-full bg-primary" />
              <p className="text-sm">Record created from <span className="font-medium">{f.sourceType}</span></p>
              <p className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</p>
            </li>
            <li className="relative">
              <span className="absolute -left-[26px] mt-1 h-2 w-2 rounded-full bg-info" />
              <p className="text-sm">Confidence scored at {f.confidence}%</p>
              <p className="text-xs text-muted-foreground">{new Date(f.updatedAt).toLocaleString()}</p>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
