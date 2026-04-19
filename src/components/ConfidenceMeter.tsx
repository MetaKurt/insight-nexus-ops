import { cn } from "@/lib/utils";

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 75 ? "bg-success" : v >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${v}%` }} />
      </div>
      <span className="w-8 text-xs tabular-nums text-muted-foreground">{v}%</span>
    </div>
  );
}
