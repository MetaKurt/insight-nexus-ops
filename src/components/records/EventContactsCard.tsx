import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Linkedin, Twitter, Globe, Mail, CheckCircle2, Mic2, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

function ContactRowItem({ c }: { c: ContactRow }) {
  const linkedin = c.linkedin_url || (c.social_url && /linkedin\.com/i.test(c.social_url) ? c.social_url : null);
  const twitter = c.twitter_url || (c.social_url && /(twitter|x)\.com/i.test(c.social_url) ? c.social_url : null);
  const realWebsite = isRealWebsite(c.website);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link to={`/contacts/${c.id}`} className="block font-medium hover:text-primary">
          {c.name ?? "(unnamed)"}
        </Link>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {[c.role_title, c.organization].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
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
  );
}

export function EventContactsCard({ findingId }: { findingId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["event-contacts", findingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id,name,organization,role_title,email,website,linkedin_url,twitter_url,social_url,source,email_verification_status",
        )
        .eq("finding_id", findingId)
        .order("source", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContactRow[];
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-surface-elevated border-border/60">
        <CardHeader><CardTitle className="text-base">Contacts from this event</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24" /></CardContent>
      </Card>
    );
  }

  const contacts = data ?? [];
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
      <CardHeader>
        <CardTitle className="text-base">
          Contacts from this event{" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({contacts.length})
          </span>
        </CardTitle>
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
