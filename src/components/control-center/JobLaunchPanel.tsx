import { useState } from "react";
import {
  Sparkles,
  Building2,
  Gem,
  UserPlus2,
  RefreshCw,
  RadioTower,
  Download,
  ShieldCheck,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { jobTypeCatalog } from "@/mocks/jobs";
import { JobLaunchDialog } from "./JobLaunchDialog";
import type { JobType } from "@/types/jobs";
import { cn } from "@/lib/utils";

const iconMap: Record<JobType, typeof Sparkles> = {
  tedx_scrape: Sparkles,
  hotel_lead_research: Building2,
  nvrland_research: Gem,
  client_enrichment: UserPlus2,
  retry_failed_records: RefreshCw,
  refresh_source_scan: RadioTower,
  export_data: Download,
};

const categoryTone: Record<string, string> = {
  research: "border-primary/30 bg-primary/5 text-primary",
  enrichment: "border-info/30 bg-info/5 text-info",
  maintenance: "border-warning/30 bg-warning/5 text-warning",
  export: "border-muted text-muted-foreground",
};

export function JobLaunchPanel() {
  const [open, setOpen] = useState(false);
  const [jobType, setJobType] = useState<JobType | undefined>();

  return (
    <>
      <Card className="border-border/60 bg-surface-elevated">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Launch a job</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pick an approved job type. The request is queued for the worker machine.
              </p>
            </div>
            <Badge
              variant="outline"
              className="hidden border-primary/30 bg-primary/10 text-primary md:inline-flex"
            >
              <ShieldCheck className="mr-1 h-3 w-3" /> Approved actions only
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {jobTypeCatalog.map((def) => {
              const Icon = iconMap[def.id];
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => {
                    setJobType(def.id);
                    setOpen(true);
                  }}
                  className="group rounded-lg border border-border/60 bg-surface p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-glow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-md bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                        categoryTone[def.category],
                      )}
                    >
                      {def.category}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium">{def.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{def.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setJobType(undefined);
                setOpen(true);
              }}
            >
              Custom launch…
            </Button>
          </div>
        </CardContent>
      </Card>

      <JobLaunchDialog open={open} onOpenChange={setOpen} defaultJobType={jobType} />
    </>
  );
}
