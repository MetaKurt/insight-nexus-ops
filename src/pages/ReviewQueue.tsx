import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Check, X, Flag, Tag as TagIcon, ChevronRight, LayoutList, IdCard } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TagChip } from "@/components/TagChip";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

type Mode = "inbox" | "focus";

export default function ReviewQueue() {
  const { workspaceId } = useWorkspace();
  const [mode, setMode] = useState<Mode>("inbox");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);

  const { data: findings = [] } = useQuery({
    queryKey: ["findings", workspaceId],
    queryFn: () => api.findings.list(workspaceId),
  });

  const queue = useMemo(
    () => findings.filter((f) => f.status === "new" || f.status === "in_review" || f.status === "flagged"),
    [findings],
  );

  const act = (label: string) => {
    toast.success(`${label} (mock)`);
    setFocusIdx((i) => Math.min(i + 1, queue.length - 1));
  };

  // Keyboard shortcuts in focus mode
  useEffect(() => {
    if (mode !== "focus") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A") act("Approved");
      if (e.key === "r" || e.key === "R") act("Rejected");
      if (e.key === "f" || e.key === "F") act("Flagged");
      if (e.key === "t" || e.key === "T") act("Tagged");
      if (e.key === "ArrowRight") setFocusIdx((i) => Math.min(i + 1, queue.length - 1));
      if (e.key === "ArrowLeft") setFocusIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, queue.length]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const focusItem = queue[focusIdx];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Triage"
        title="Review Queue"
        description="Approve, reject, flag, or tag newly collected research signals."
        actions={
          <div className="flex rounded-md border border-border bg-surface-elevated p-0.5">
            <Button
              variant={mode === "inbox" ? "secondary" : "ghost"} size="sm" className="h-8 gap-1.5"
              onClick={() => setMode("inbox")}
            ><LayoutList className="h-3.5 w-3.5" /> Inbox</Button>
            <Button
              variant={mode === "focus" ? "secondary" : "ghost"} size="sm" className="h-8 gap-1.5"
              onClick={() => setMode("focus")}
            ><IdCard className="h-3.5 w-3.5" /> Focus</Button>
          </div>
        }
      />

      {queue.length === 0 ? (
        <EmptyState icon={Inbox} title="Inbox zero" description="No items awaiting review. Great work." />
      ) : mode === "inbox" ? (
        <div className="space-y-3">
          {selected.size > 0 && (
            <Card className="flex items-center justify-between gap-3 border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-medium"><span className="text-primary">{selected.size}</span> selected</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { toast.success(`Approved ${selected.size}`); setSelected(new Set()); }}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { toast.success(`Rejected ${selected.size}`); setSelected(new Set()); }}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                </Button>
                <Button size="sm" variant="outline" onClick={() => { toast.success(`Flagged ${selected.size}`); setSelected(new Set()); }}>
                  <Flag className="mr-1.5 h-3.5 w-3.5" /> Flag
                </Button>
              </div>
            </Card>
          )}
          {queue.map((f) => (
            <Card key={f.id} className="border-border/60 bg-surface-elevated">
              <CardContent className="flex items-center gap-4 p-4">
                <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{f.title}</p>
                    <StatusBadge status={f.status} />
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{f.summary}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {f.tags.map((t) => <TagChip key={t} label={t} />)}
                    <ConfidenceMeter value={f.confidence} className="ml-2" />
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-success" onClick={() => toast.success("Approved (mock)")}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => toast.success("Rejected (mock)")}><X className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-warning" onClick={() => toast.success("Flagged (mock)")}><Flag className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        focusItem && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{focusIdx + 1} of {queue.length}</span>
              <span className="font-mono">A approve · R reject · F flag · T tag · → next</span>
            </div>
            <Card className="border-border/60 bg-surface-elevated shadow-elegant">
              <CardContent className="p-8">
                <div className="flex items-center gap-2">
                  <StatusBadge status={focusItem.status} />
                  <ConfidenceMeter value={focusItem.confidence} />
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{focusItem.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{focusItem.summary}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {focusItem.tags.map((t) => <TagChip key={t} label={t} />)}
                </div>
                <a href={focusItem.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 block truncate text-xs text-primary hover:underline">
                  {focusItem.sourceUrl}
                </a>
                <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-sm">
                  {Object.entries(focusItem.extractedFields).map(([k, v]) => (
                    <div key={k}><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd className="truncate">{v?.toString() ?? "—"}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <div className="flex justify-center gap-2">
              <Button size="lg" variant="outline" className={cn("border-success/40 text-success hover:bg-success/10")} onClick={() => act("Approved")}><Check className="mr-1.5 h-4 w-4" /> Approve</Button>
              <Button size="lg" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => act("Rejected")}><X className="mr-1.5 h-4 w-4" /> Reject</Button>
              <Button size="lg" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10" onClick={() => act("Flagged")}><Flag className="mr-1.5 h-4 w-4" /> Flag</Button>
              <Button size="lg" variant="outline" onClick={() => act("Tagged")}><TagIcon className="mr-1.5 h-4 w-4" /> Tag</Button>
              <Button size="lg" onClick={() => setFocusIdx((i) => Math.min(i + 1, queue.length - 1))}>Skip <ChevronRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
