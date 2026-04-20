// Small explainer that clarifies why the in-app log stream can look "live"
// while the worker's terminal stays static. Includes a copy button for the
// journalctl follow command.

import { useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const FOLLOW_CMD = "sudo journalctl -u signalhub-worker -f";

export function JournalTipCallout() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FOLLOW_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-info/30 bg-info/5 p-3 text-xs">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          Logs update from Supabase in real time.
        </p>
        <p className="mt-1 text-muted-foreground">
          On your worker machine, the terminal stays static unless you actively follow the journal:
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground">
            {FOLLOW_CMD}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={copy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="ml-1 text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
