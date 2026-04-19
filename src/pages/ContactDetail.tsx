import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Globe, Linkedin, Users, Calendar } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export default function ContactDetail() {
  const { id = "" } = useParams();
  const { data: c, isLoading } = useQuery({ queryKey: ["contact", id], queryFn: () => api.contacts.get(id) });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!c) return <EmptyState icon={Users} title="Contact not found" />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/contacts"><ArrowLeft className="mr-1 h-4 w-4" /> Back to contacts</Link>
      </Button>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-semibold text-primary">
          {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1">
          <PageHeader
            title={c.name}
            description={`${c.role ?? ""} · ${c.organization ?? ""}`}
            actions={
              <>
                <Button variant="outline" onClick={() => toast.success("Email composer (mock)")}>Email</Button>
                <Button onClick={() => toast.success("Added to outreach queue (mock)")}>Queue outreach</Button>
              </>
            }
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusBadge status={c.outreachStatus} />
            <ConfidenceMeter value={c.confidence} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-surface-elevated border-border/60 lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Contact details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {c.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {c.email}</div>}
            {c.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {c.phone}</div>}
            {c.website && <a className="flex items-center gap-2 text-primary hover:underline" href={c.website} target="_blank" rel="noreferrer"><Globe className="h-4 w-4" /> {c.website}</a>}
            {c.social?.linkedin && <a className="flex items-center gap-2 text-primary hover:underline" href={c.social.linkedin} target="_blank" rel="noreferrer"><Linkedin className="h-4 w-4" /> LinkedIn</a>}
            {c.notes && <p className="rounded-md bg-muted/40 p-3 text-muted-foreground">{c.notes}</p>}
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border/60">
          <CardHeader><CardTitle className="text-base">Source & metadata</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {c.event && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Event</p>
                <Link to={`/records/${c.event.id}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Calendar className="h-4 w-4" /> {c.event.name}
                </Link>
                {(c.event.date || c.event.location) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {[c.event.date, c.event.location].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            )}
            <div><p className="text-xs uppercase text-muted-foreground">Source</p><p>{c.source}</p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Created</p><p>{new Date(c.createdAt).toLocaleString()}</p></div>
            {c.projectId && <div><p className="text-xs uppercase text-muted-foreground">Project</p><Link to={`/projects/${c.projectId}`} className="text-primary hover:underline">View project</Link></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
