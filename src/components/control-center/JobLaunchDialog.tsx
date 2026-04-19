import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Rocket, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { api } from "@/lib/api";
import { jobTypeCatalog } from "@/mocks/jobs";
import { projects as allProjects } from "@/mocks/data";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { JobPayload, JobPriority, JobType, JobTypeDefinition } from "@/types/jobs";

interface JobLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJobType?: JobType;
}

export function JobLaunchDialog({ open, onOpenChange, defaultJobType }: JobLaunchDialogProps) {
  const { workspaceId, workspaces } = useWorkspace();
  const qc = useQueryClient();

  const [jobType, setJobType] = useState<JobType>(defaultJobType ?? "tedx_scrape");
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<string>("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [urls, setUrls] = useState("");
  const [limit, setLimit] = useState<string>("500");
  const [notes, setNotes] = useState("");
  // tedx_scrape specific
  const [country, setCountry] = useState("United States");
  const [yearsStr, setYearsStr] = useState("2026, 2027");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [maxPages, setMaxPages] = useState<string>("10");
  // email_lookup specific
  const [maxLookups, setMaxLookups] = useState<string>("10");
  const [forceReenrich, setForceReenrich] = useState(false);

  const definition: JobTypeDefinition =
    jobTypeCatalog.find((d) => d.id === jobType) ?? jobTypeCatalog[0];

  // Reset form when dialog opens or job type changes
  useEffect(() => {
    if (open) {
      const def = jobTypeCatalog.find((d) => d.id === (defaultJobType ?? "tedx_scrape"));
      if (def) {
        setJobType(def.id);
        setPriority(def.defaultPriority);
      }
      setProjectId(undefined);
      setSourceType("");
      setKeywords("");
      setLocation("");
      setUrls("");
      setLimit(def?.id === "tedx_scrape" ? "500" : "100");
      setNotes("");
      setCountry("United States");
      setYearsStr("2026, 2027");
      setAvailableOnly(true);
      setMaxPages("10");
      setMaxLookups("10");
      setForceReenrich(false);
    }
  }, [open, defaultJobType]);

  useEffect(() => {
    setPriority(definition.defaultPriority);
  }, [definition.id, definition.defaultPriority]);

  const scopedProjects = useMemo(
    () => (workspaceId === "all" ? allProjects : allProjects.filter((p) => p.workspaceId === workspaceId)),
    [workspaceId],
  );

  const targetWorkspaceId = useMemo(() => {
    if (workspaceId !== "all") return workspaceId;
    if (projectId) return allProjects.find((p) => p.id === projectId)?.workspaceId;
    return undefined;
  }, [workspaceId, projectId]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!targetWorkspaceId) throw new Error("Select a workspace or project");
      const parsedYears = yearsStr
        .split(",")
        .map((y) => parseInt(y.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 1900 && n < 2100);
      const payload: JobPayload = {
        projectId,
        sourceType: sourceType || undefined,
        keywords: keywords || undefined,
        location: location || undefined,
        urls: urls
          ? urls.split("\n").map((u) => u.trim()).filter(Boolean)
          : undefined,
        limit: limit ? Number(limit) : undefined,
        notes: notes || undefined,
        ...(jobType === "tedx_scrape" && {
          country: country || undefined,
          years: parsedYears.length ? parsedYears : undefined,
          available_only: availableOnly,
          max_pages: maxPages ? Number(maxPages) : undefined,
        }),
        ...(jobType === "email_lookup" && {
          max_lookups: maxLookups ? Number(maxLookups) : undefined,
          force_reenrich: forceReenrich || undefined,
        }),
      };
      return api.jobs.create({
        workspaceId: targetWorkspaceId,
        projectId,
        type: jobType,
        priority,
        payload,
        requestedBy: "You",
      });
    },
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job queued", {
        description: `${definition.label} (${job.id}) sent to worker queue.`,
      });
      onOpenChange(false);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const showField = (name: JobTypeDefinition["fields"][number]) =>
    definition.fields.includes(name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Rocket className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Launch job</DialogTitle>
              <DialogDescription>{definition.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
          Approved job type. Submitting writes a structured request to the queue — only
          the worker machine executes it.
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Job type</Label>
              <Select value={jobType} onValueChange={(v) => setJobType(v as JobType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {jobTypeCatalog.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as JobPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["low", "normal", "high", "urgent"] as JobPriority[]).map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showField("projectId") && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId ?? ""} onValueChange={(v) => setProjectId(v || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder={workspaceId === "all" ? "Select project (sets workspace)" : "Select project (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  {scopedProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {workspaces.find((w) => w.id === p.workspaceId)?.name}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {showField("sourceType") && (
              <div className="space-y-1.5">
                <Label>Source type</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {["website", "event_page", "social", "directory", "api", "csv"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showField("location") && (
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Spain, EU" />
              </div>
            )}
            {showField("country") && (
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United States"
                />
                <p className="text-[11px] text-muted-foreground">
                  Must match TED's spelling exactly (e.g. "United States", "United Kingdom").
                </p>
              </div>
            )}
            {showField("years") && (
              <div className="space-y-1.5">
                <Label>Years</Label>
                <Input
                  value={yearsStr}
                  onChange={(e) => setYearsStr(e.target.value)}
                  placeholder="2026, 2027"
                />
                <p className="text-[11px] text-muted-foreground">Comma-separated 4-digit years.</p>
              </div>
            )}
            {showField("availableOnly") && (
              <div className="space-y-1.5">
                <Label>Spaces available</Label>
                <Select
                  value={availableOnly ? "yes" : "no"}
                  onValueChange={(v) => setAvailableOnly(v === "yes")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Only events with spaces available</SelectItem>
                    <SelectItem value="no">All events</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {showField("maxPages") && (
              <div className="space-y-1.5">
                <Label>Max listing pages</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Stop after N pages. With filters applied, 5–15 is usually enough.
                </p>
              </div>
            )}
            {showField("maxLookups") && (
              <div className="space-y-1.5">
                <Label>Max Hunter lookups</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={maxLookups}
                  onChange={(e) => setMaxLookups(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Hard cap on Hunter API calls this run. Free tier = 25/month.
                </p>
              </div>
            )}
            {showField("forceReenrich") && (
              <div className="space-y-1.5">
                <Label>Force re-enrich</Label>
                <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
                  <Switch checked={forceReenrich} onCheckedChange={setForceReenrich} />
                  <span className="text-xs text-muted-foreground">
                    {forceReenrich ? "Re-query contacts enriched in last 90 days" : "Skip recently enriched contacts"}
                  </span>
                </div>
              </div>
            )}
            {showField("keywords") && (
              <div className="space-y-1.5 col-span-2">
                <Label>Keywords</Label>
                <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="comma-separated (optional name filter)" />
              </div>
            )}
            {showField("limit") && (
              <div className="space-y-1.5">
                <Label>Limit</Label>
                <Input type="number" min={1} max={5000} value={limit} onChange={(e) => setLimit(e.target.value)} />
              </div>
            )}
          </div>

          {showField("urls") && (
            <div className="space-y-1.5">
              <Label>URL list</Label>
              <Textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={"https://example.com\nhttps://another.com"}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          )}

          {showField("notes") && (
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Queue job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
