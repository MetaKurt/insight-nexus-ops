import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Linkedin, Twitter, Globe, Mail, CheckCircle2, Mic2, Users, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

type ContactRow = {
  id: string;
  name: string | null;
  organization: string | null;
  role_title: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  social_url: string | null;
  source: string | null;
  email_verification_status: string | null;
  bio: string | null;
  photo_url: string | null;
  project_id: string | null;
};

const BLOCKED_HOSTS = new Set([
  "ted.com", "linkedin.com", "twitter.com", "x.com",
  "facebook.com", "instagram.com", "youtube.com", "youtu.be",
  "eventbrite.com", "meetup.com", "wikipedia.org", "medium.com",
]);

function normalizeUrl(raw: string) {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function isRealWebsite(raw?: string | null) {
  if (!raw) return false;
  try {
    const host = new URL(normalizeUrl(raw)).hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") && !BLOCKED_HOSTS.has(host);
  } catch {
    return false;
  }
}

function verifColor(status?: string | null) {
  if (status === "deliverable" || status === "valid") return "text-success";
  if (status === "risky" || status === "accept_all") return "text-warning";
  if (status === "undeliverable" || status === "invalid") return "text-destructive";
  return "text-muted-foreground";
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function ContactRowItem({ c }: { c: ContactRow }) {
  const [expanded, setExpanded] = useState(false);
  const linkedin = c.linkedin_url || (c.social_url && /linkedin\.com/i.test(c.social_url) ? c.social_url : null);
  const twitter = c.twitter_url || (c.social_url && /(twitter|x)\.com/i.test(c.social_url) ? c.social_url : null);
  const realWebsite = isRealWebsite(c.website);
  const bio = (c.bio || "").trim();
  const showBioToggle = bio.length > 180;

  return (
    <div className="flex items-start gap-3 border-b border-border/40 py-3 last:border-b-0">
      <Avatar className="h-9 w-9 shrink-0">
        {c.photo_url ? <AvatarImage src={c.photo_url} alt={c.name ?? ""} /> : null}
        <AvatarFallback className="text-[11px] font-medium">{initials(c.name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link to={`/contacts/${c.id}`} className="block font-medium leading-tight hover:text-primary">
              {c.name ?? "(unnamed)"}
            </Link>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {[c.role_title, c.organization].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {c.email && (
              <span title={c.email} className={`inline-flex items-center gap-1 ${verifColor(c.email_verification_status)}`}>
                <Mail className="h-3.5 w-3.5" />
                {c.email_verification_status === "deliverable" && (
                  <CheckCircle2 className="h-3 w-3" />
                )}
              </span>
            )}
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="LinkedIn">
                <Linkedin className="h-3.5 w-3.5" />
              </a>
            )}
            {twitter && (
              <a href={twitter} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Twitter">
                <Twitter className="h-3.5 w-3.5" />
              </a>
            )}
            {realWebsite && (
              <a href={normalizeUrl(c.website!)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Website" title={c.website ?? undefined}>
                <Globe className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {bio && (
          <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            <p className={expanded ? "" : "line-clamp-2"}>{bio}</p>
            {showBioToggle && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                {expanded ? "less" : "more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function EventContactsCard({ findingId }: { findingId: string }) {
  const qc = useQueryClient();
  const [enriching, setEnriching] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["event-contacts", findingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id,name,organization,role_title,email,website,linkedin_url,twitter_url,social_url,source,email_verification_status,bio,photo_url,project_id",
        )
        .eq("finding_id", findingId)
        .order("source", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContactRow[];
    },
  });

  const contacts = data ?? [];

  const handleEnrich = async () => {
    if (contacts.length === 0) return;
    setEnriching(true);
    try {
      const contactIds = contacts.map((c) => c.id);
      const projectId = contacts.find((c) => c.project_id)?.project_id ?? null;
      const basePayload = { contact_ids: contactIds, projectId };

      const { error: e1 } = await supabase.from("jobs").insert({
        job_type: "contact_web_enrich",
        status: "queued",
        priority: 7,
        project_id: projectId,
        payload: basePayload as never,
        requested_by: "event-card",
        notes: `Find LinkedIn for ${contactIds.length} contacts (event ${findingId})`,
      });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("jobs").insert({
        job_type: "email_lookup",
        status: "queued",
        priority: 6,
        project_id: projectId,
        payload: basePayload as never,
        requested_by: "event-card",
        notes: `Find email for ${contactIds.length} contacts (event ${findingId})`,
      });
      if (e2) throw e2;

      toast.success(`Queued enrichment for ${contactIds.length} contacts`, {
        description: "LinkedIn lookup runs first, then Hunter email lookup. Refresh in ~2 min.",
      });
      qc.invalidateQueries({ queryKey: ["event-contacts", findingId] });
    } catch (err) {
      toast.error("Failed to queue enrichment", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEnriching(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-surface-elevated border-border/60">
        <CardHeader><CardTitle className="text-base">Contacts from this event</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24" /></CardContent>
      </Card>
    );
  }

  if (contacts.length === 0) {
    return (
      <Card className="bg-surface-elevated border-border/60">
        <CardHeader><CardTitle className="text-base">Contacts from this event</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No contacts yet. Run the <span className="font-medium text-foreground">Enrich Contacts</span> stage to scrape speakers and organizers from this page.
        </CardContent>
      </Card>
    );
  }

  const speakers = contacts.filter((c) => c.source === "tedx_speaker");
  const organizers = contacts.filter((c) => c.source !== "tedx_speaker");

  return (
    <Card className="bg-surface-elevated border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">
          Contacts from this event{" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({contacts.length})
          </span>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={handleEnrich} disabled={enriching}>
          {enriching ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          Find LinkedIn & email
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {speakers.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Mic2 className="h-3 w-3" /> Speakers ({speakers.length})
            </div>
            <div>{speakers.map((c) => <ContactRowItem key={c.id} c={c} />)}</div>
          </div>
        )}
        {organizers.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-3 w-3" /> Organizers ({organizers.length})
            </div>
            <div>{organizers.map((c) => <ContactRowItem key={c.id} c={c} />)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
