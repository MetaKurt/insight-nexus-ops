import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Variant = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const styles: Record<Variant, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
};

const map: Record<string, Variant> = {
  // Project status
  active: "success",
  paused: "warning",
  archived: "neutral",
  planning: "info",
  // Record status
  new: "info",
  in_review: "warning",
  approved: "success",
  rejected: "danger",
  flagged: "warning",
  duplicate: "neutral",
  complete: "success",
  // Run status
  queued: "neutral",
  running: "info",
  success: "success",
  partial: "warning",
  failed: "danger",
  cancelled: "neutral",
  // Outreach
  not_contacted: "neutral",
  contacted: "info",
  replied: "success",
  bounced: "danger",
  do_not_contact: "danger",
  // Source health
  healthy: "success",
  degraded: "warning",
  down: "danger",
  unknown: "neutral",
  // Severity
  low: "info",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const v = map[status] ?? "neutral";
  const label = status.replace(/_/g, " ");
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium capitalize tracking-tight",
        styles[v],
        className,
      )}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </Badge>
  );
}
