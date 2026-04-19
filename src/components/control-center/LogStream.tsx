import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JobLog, LogLevel } from "@/types/jobs";

const levelTone: Record<LogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-info",
  warning: "text-warning",
  error: "text-destructive",
};

const levelBg: Record<LogLevel, string> = {
  debug: "bg-muted/40",
  info: "bg-info/10",
  warning: "bg-warning/10",
  error: "bg-destructive/10",
};

interface LogStreamProps {
  logs: JobLog[];
  showJobLink?: boolean;
  emptyText?: string;
}

const LEVELS: LogLevel[] = ["info", "warning", "error", "debug"];

export function LogStream({ logs, showJobLink = false, emptyText = "No logs yet." }: LogStreamProps) {
  const [active, setActive] = useState<Set<LogLevel>>(new Set(LEVELS));
  const [search, setSearch] = useState("");

  const toggle = (lvl: LogLevel) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  const filtered = useMemo(
    () =>
      logs
        .filter((l) => active.has(l.level))
        .filter((l) => (search ? l.message.toLowerCase().includes(search.toLowerCase()) : true))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [logs, active, search],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter messages…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((lvl) => (
            <Button
              key={lvl}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => toggle(lvl)}
              className={cn(
                "h-7 px-2 text-[11px] uppercase tracking-wider",
                active.has(lvl) ? levelBg[lvl] : "opacity-50",
                levelTone[lvl],
              )}
            >
              {lvl}
            </Button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden border-border/60 bg-background">
        <div className="max-h-[420px] overflow-y-auto font-mono text-xs">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">{emptyText}</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((l) => (
                <li key={l.id} className="grid grid-cols-[110px_70px_1fr] items-start gap-2 px-3 py-1.5 hover:bg-muted/20">
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(l.at).toLocaleTimeString()}
                  </span>
                  <span className={cn("font-semibold uppercase tracking-wider", levelTone[l.level])}>
                    {l.level}
                  </span>
                  <span className="break-words">
                    {l.message}
                    {showJobLink && (
                      <Link
                        to={`/control-center/jobs/${l.jobId}`}
                        className="ml-2 text-muted-foreground hover:text-primary"
                      >
                        [{l.jobId}]
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
