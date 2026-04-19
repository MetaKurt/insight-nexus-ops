import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
};

const tagColor = (label: string) => {
  const map: Record<string, string> = {
    hot: "destructive",
    priority: "destructive",
    warm: "warning",
    "follow-up": "warning",
    cold: "info",
    luxury: "primary",
    boutique: "primary",
    event: "info",
    speaker: "primary",
    collector: "warning",
  };
  return map[label] ?? "primary";
};

export function TagChip({ label, className }: { label: string; className?: string }) {
  const c = colorMap[tagColor(label)];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        c,
        className,
      )}
    >
      #{label}
    </span>
  );
}
