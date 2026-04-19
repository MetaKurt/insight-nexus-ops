import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { FilterBar } from "@/components/FilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Sources() {
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => api.sources.list(workspaceId),
  });

  const filtered = sources.filter((s) =>
    [s.name, s.type, s.url].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Origins"
        title="Sources"
        description="Where your data comes from — websites, directories, social, APIs, and manual imports."
        actions={<Button onClick={() => toast.success("Add source dialog (mock)")}><Plus className="mr-1.5 h-4 w-4" /> Add source</Button>}
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Search sources…" />

      {!isLoading && filtered.length === 0 ? (
        <EmptyState icon={Globe2} title="No sources yet" description="Add a source to start collecting research signals." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="border-border/60 bg-surface-elevated">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{s.name}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">{s.type.replace(/_/g, " ")}</p>
                  </div>
                  <StatusBadge status={s.health} />
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="mt-3 block truncate text-xs text-primary hover:underline">
                    {s.url}
                  </a>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-center">
                  <div>
                    <p className="text-lg font-semibold tabular-nums">{s.recordsProduced}</p>
                    <p className="text-[11px] text-muted-foreground">Records produced</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last run</p>
                    <p className="text-sm">{s.lastRunAt ? new Date(s.lastRunAt).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
