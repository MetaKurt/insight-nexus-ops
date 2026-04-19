import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Mail, Phone } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const outreach = ["all", "not_contacted", "queued", "contacted", "replied", "bounced", "do_not_contact"];

export default function Contacts() {
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", workspaceId],
    queryFn: () => api.contacts.list(workspaceId),
  });

  const filtered = useMemo(() => contacts.filter((c) => {
    if (status !== "all" && c.outreachStatus !== status) return false;
    if (search && ![c.name, c.organization, c.role, c.email].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [contacts, status, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People & organizations"
        title="Contacts"
        description="The CRM layer of SignalHub — contacts discovered via research and enrichment."
        actions={<Button onClick={() => toast.success("Import dialog (mock)")}>Import contacts</Button>}
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Search by name, org, email…">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{outreach.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
      </FilterBar>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState icon={Users} title="No contacts match" />
      ) : (
        <Card className="border-border/60 bg-surface-elevated overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Outreach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/contacts/${c.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </span>
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.organization}</TableCell>
                  <TableCell className="text-muted-foreground">{c.role}</TableCell>
                  <TableCell className="space-y-1 text-xs">
                    {c.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {c.email}</div>}
                    {c.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {c.phone}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.source}</TableCell>
                  <TableCell><ConfidenceMeter value={c.confidence} /></TableCell>
                  <TableCell><StatusBadge status={c.outreachStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
