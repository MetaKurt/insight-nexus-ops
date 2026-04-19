// Mission Builder chat — talk to an LLM to design a multi-stage mission.
// Each user turn POSTs the full conversation to the mission-builder edge fn.
// The response can include `content` (assistant text) and/or `plan` (a
// structured proposal rendered inline as a reviewable card).

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  MissionPlanPreview,
  type ProposedPlan,
} from "@/components/missions/MissionPlanPreview";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  plan?: ProposedPlan;
}

const SUGGESTIONS = [
  "Find all upcoming TEDx events in the US for 2026/2027 with spaces available, then get organizer contacts.",
  "Research mid-size hotels in Florida with event spaces, then enrich with sales contacts.",
  "Re-run all failed records from last week and export anything that succeeds to CSV.",
];

export default function MissionBuilder() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Tell me what you're trying to accomplish in plain English. I'll ask a few clarifying questions and then propose a mission plan you can review and create with one click.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke("mission-builder", {
        body: {
          // Strip the optional `plan` field — the model only needs role/content.
          messages: next.map(({ role, content }) => ({ role, content })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content:
          data.content ||
          (data.plan
            ? "Here's a proposed plan — review the stages below and click **Create mission** when you're happy with it."
            : "(no response)"),
        plan: data.plan ?? undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      toast.error(msg);
      // Roll back the user message so they can retry without losing context.
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/missions">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> All missions
        </Link>
      </Button>

      <PageHeader
        eyebrow="New Mission"
        title="Mission Builder"
        description="Describe your goal. The AI will ask clarifying questions and propose a multi-stage pipeline you can create with one click."
        actions={
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by Lovable AI
          </span>
        }
      />

      <Card className="flex h-[calc(100vh-22rem)] min-h-[480px] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex w-full",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] space-y-3",
                  m.role === "user" ? "" : "w-full",
                )}
              >
                {m.content && (
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2.5 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-foreground",
                    )}
                  >
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {m.plan && <MissionPlanPreview plan={m.plan} />}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          )}

          {messages.length === 1 && !busy && (
            <div className="space-y-2 pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Try one of these
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background/40 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Describe your goal, or answer the question above…"
              rows={2}
              disabled={busy}
              className="min-h-[44px] resize-none"
            />
            <Button type="submit" disabled={busy || !input.trim()} className="h-11">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </Card>
    </div>
  );
}
