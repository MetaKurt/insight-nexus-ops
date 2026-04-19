// Subscribes to Supabase Realtime for the Control Center tables and
// invalidates the relevant React Query caches on every change. Mount
// once at the page level — duplicate mounts are safe but wasteful.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useJobsRealtime(jobId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("control-center-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          qc.invalidateQueries({ queryKey: ["jobs"] });
          if (jobId) qc.invalidateQueries({ queryKey: ["job", jobId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_logs" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["job-logs"] });
          const row = (payload.new ?? payload.old) as { job_id?: string } | null;
          if (row?.job_id) {
            qc.invalidateQueries({ queryKey: ["job-logs", row.job_id] });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workers" },
        () => {
          qc.invalidateQueries({ queryKey: ["workers"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, jobId]);
}
