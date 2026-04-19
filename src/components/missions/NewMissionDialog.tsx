// Dialog to compose a new mission with N ordered stages.
// Each stage picks a job_type from the catalog, has a name + JSON payload,
// optionally depends on a previous stage, and toggles requires_review.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { jobTypeCatalog } from "@/mocks/jobs";
import { missionsApi } from "@/lib/missionsApi";
import { useAuth } from "@/hooks/useAuth";
import type { DraftStage } from "@/types/missions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const blankStage = (): DraftStage => ({
  name: "",
  description: "",
  job_type: jobTypeCatalog[0]?.id ?? "hello",
  payload: {},
  requires_review: true,
  depends_on_index: null,
});

export function NewMissionDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<DraftStage[]>([blankStage()]);
  const [payloadDrafts, setPayloadDrafts] = useState<string[]>(["{}"]);

  const reset = () => {
    setName("");
    setDescription("");
    setStages([blankStage()]);
    setPayloadDrafts(["{}"]);
  };

  const addStage = () => {
    setStages((s) => [
      ...s,
      { ...blankStage(), depends_on_index: s.length - 1 },
    ]);
    setPayloadDrafts((p) => [...p, "{}"]);
  };

  const removeStage = (i: number) => {
    setStages((s) => s.filter((_, idx) => idx !== i));
    setPayloadDrafts((p) => p.filter((_, idx) => idx !== i));
  };

  const updateStage = (i: number, patch: Partial<DraftStage>) => {
    setStages((s) => s.map((stg, idx) => (idx === i ? { ...stg, ...patch } : stg)));
  };

  const create = useMutation({
    mutationFn: async () => {
      // Validate + parse payload JSON for each stage
      const parsed: DraftStage[] = stages.map((s, i) => {
        let payload: Record<string, unknown> = {};
        const raw = (payloadDrafts[i] ?? "").trim();
        if (raw) {
          try {
            payload = JSON.parse(raw);
          } catch {
            throw new Error(`Stage ${i + 1} payload is not valid JSON`);
          }
        }
        if (!s.name.trim()) throw new Error(`Stage ${i + 1} needs a name`);
        return { ...s, payload };
      });

      if (!name.trim()) throw new Error("Mission needs a name");

      return missionsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        created_by: user?.email ?? user?.id ?? null,
        stages: parsed,
      });
    },
    onSuccess: (mission) => {
      toast.success("Mission created");
      qc.invalidateQueries({ queryKey: ["missions"] });
      reset();
      onOpenChange(false);
      navigate(`/missions/${mission.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Mission</DialogTitle>
          <DialogDescription>
            Compose an ordered pipeline of stages. Each stage runs as a job; downstream stages
            auto-queue when their upstream is approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3">
            <div>
              <Label htmlFor="mname">Mission name</Label>
              <Input
                id="mname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. TEDx US 2026/2027 Outreach"
              />
            </div>
            <div>
              <Label htmlFor="mdesc">Description (optional)</Label>
              <Textarea
                id="mdesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this mission trying to accomplish?"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Stages</h3>
            <Button size="sm" variant="outline" onClick={addStage}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add stage
            </Button>
          </div>

          <div className="space-y-3">
            {stages.map((stage, i) => (
              <Card key={i} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                      {i + 1}
                    </span>
                    Stage {i + 1}
                  </div>
                  {stages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStage(i)}
                      className="h-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={stage.name}
                      onChange={(e) => updateStage(i, { name: e.target.value })}
                      placeholder="e.g. Discover events"
                    />
                  </div>
                  <div>
                    <Label>Job type</Label>
                    <Select
                      value={stage.job_type}
                      onValueChange={(v) => updateStage(i, { job_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {jobTypeCatalog.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Description (optional)</Label>
                  <Input
                    value={stage.description ?? ""}
                    onChange={(e) => updateStage(i, { description: e.target.value })}
                    placeholder="What does this stage produce?"
                  />
                </div>

                <div>
                  <Label>Payload (JSON)</Label>
                  <Textarea
                    value={payloadDrafts[i] ?? "{}"}
                    onChange={(e) =>
                      setPayloadDrafts((p) => p.map((v, idx) => (idx === i ? e.target.value : v)))
                    }
                    placeholder='{"limit": 100, "location": "United States"}'
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {i > 0 && (
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs">Depends on</Label>
                      <Select
                        value={stage.depends_on_index === null ? "none" : String(stage.depends_on_index)}
                        onValueChange={(v) =>
                          updateStage(i, { depends_on_index: v === "none" ? null : Number(v) })
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nothing (parallel)</SelectItem>
                          {stages.slice(0, i).map((s, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              Stage {idx + 1}: {s.name || "(unnamed)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <Switch
                      checked={stage.requires_review}
                      onCheckedChange={(c) => updateStage(i, { requires_review: c })}
                    />
                    <Label className="text-xs">Pause for human review when done</Label>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Create mission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
