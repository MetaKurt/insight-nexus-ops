import { useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, HelpCircle, Loader2, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EmailVerification } from "@/types";

interface Props {
  contactId: string;
  email: string;
  status?: EmailVerification;
  score?: number;
  /** "icon" = small icon-only button (table rows). "full" = full button with label. */
  size?: "icon" | "full";
}

function statusVisual(status?: EmailVerification): {
  icon: typeof CheckCircle2;
  cls: string;
  label: string;
} {
  switch ((status ?? "").toLowerCase()) {
    case "deliverable":
    case "valid":
      return { icon: CheckCircle2, cls: "text-emerald-500", label: "Deliverable" };
    case "risky":
    case "accept_all":
      return { icon: AlertCircle, cls: "text-amber-500", label: "Risky" };
    case "undeliverable":
    case "invalid":
      return { icon: XCircle, cls: "text-red-500", label: "Undeliverable" };
    default:
      return { icon: HelpCircle, cls: "text-muted-foreground", label: "Not verified" };
  }
}

export function VerifyEmailButton({ contactId, email, status, score, size = "icon" }: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const visual = statusVisual(status);
  const Icon = loading ? Loader2 : visual.icon;

  const verify = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-email", {
        body: { contact_id: contactId },
      });
      if (error) throw error;
      const result = (data ?? {}) as { status?: string; score?: number };
      toast.success(`Hunter says: ${result.status ?? "unknown"}${result.score != null ? ` (${result.score})` : ""}`);
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      await qc.invalidateQueries({ queryKey: ["contact", contactId] });
    } catch (err) {
      toast.error(`Verify failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  if (size === "full") {
    return (
      <Button size="sm" variant="outline" onClick={verify} disabled={loading || !email}>
        <ShieldCheck className={`mr-2 h-4 w-4 ${visual.cls}`} />
        {loading ? "Verifying…" : status ? `Re-verify (${visual.label.toLowerCase()}${score != null ? ` · ${score}` : ""})` : "Verify email"}
      </Button>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={verify}
            disabled={loading || !email}
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-50"
            aria-label="Verify email with Hunter"
          >
            <Icon className={`h-3.5 w-3.5 ${visual.cls} ${loading ? "animate-spin" : ""}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {status
            ? `${visual.label}${score != null ? ` (score ${score})` : ""} — click to re-verify`
            : "Click to verify with Hunter.io"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
