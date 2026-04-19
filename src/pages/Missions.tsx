// Missions list page — shows all missions with status + stage counts.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Target } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { NewMissionDialog } from "@/components/missions/NewMissionDialog";
import { missionsApi } from "@/lib/missionsApi";
import { supabase } from "@/integrations/supabase/client";

export default function Missions() {
  const [open, setOpen] = useState(false);

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: missionsApi.list,
  });

  // Aggregate stage counts per mission in one query.
  const { data: stageCounts = {} } = useQuery({
    queryKey: ["mission-stage-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_stages")
        .select("mission_id, status");
      if (error) throw error;
      const map: Record<string, { total: number; done: number }> = {};
      for (const row of data ?? []) {
        const id = row.mission_id as string;
        map[id] ??= { total: 0, done: 0 };
        map[id].total += 1;
        if (row.status === "done" || row.status === "skipped") map[id].done += 1;
      }
      return map;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Missions"
        description="Multi-stage research pipelines. Each mission chains jobs together with optional human-review gates between stages."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New mission
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : missions.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No missions yet"
          description="Compose a multi-stage pipeline — for example: discover events → enrich organizers → find emails."
          action={{ label: "Create your first mission", onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {missions.map((m) => {
            const counts = stageCounts[m.id] ?? { total: 0, done: 0 };
            return (
              <Link key={m.id} to={`/missions/${m.id}`}>
                <Card className="group h-full space-y-3 p-5 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-base font-semibold group-hover:text-primary">
                      {m.name}
                    </h3>
                    <StatusBadge status={m.status} />
                  </div>
                  {m.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {counts.done} / {counts.total} stages complete
                    </span>
                    <span>{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <NewMissionDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
