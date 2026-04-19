import { toast } from "sonner";
import { Cloud, Key, Users as UsersIcon, Tag as TagIcon, ListChecks, Boxes } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagChip } from "@/components/TagChip";
import { tags } from "@/mocks/data";

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configuration" title="Settings" description="Manage backend connection, integrations, workspaces, tags, pipelines, and access." />

      <Tabs defaultValue="backend">
        <TabsList className="flex-wrap">
          <TabsTrigger value="backend">Backend</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="backend">
          <Card className="border-border/60 bg-surface-elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-warning/15 p-2 text-warning"><Cloud className="h-5 w-5" /></div>
                <div>
                  <CardTitle className="text-base">Lovable Cloud — not connected</CardTitle>
                  <CardDescription>SignalHub is currently running on mock data. Connect Lovable Cloud to persist real records.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">What you'll get:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Persistent database for projects, records, contacts, runs, and sources</li>
                  <li>Authentication, roles, and per-workspace access control</li>
                  <li>Edge functions to receive results from your scraping/agent pipelines</li>
                  <li>File storage for screenshots, exports, and uploaded CSVs</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => toast.info("Use the Lovable side panel to enable Cloud.")}>Connect Lovable Cloud</Button>
                <Button variant="outline" asChild>
                  <a href="https://docs.lovable.dev/features/cloud" target="_blank" rel="noreferrer">Read docs</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="border-border/60 bg-surface-elevated">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> API integrations</CardTitle>
              <CardDescription>Configure third-party APIs once a backend is connected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {["OpenAI", "LinkedIn enrichment", "Crunchbase", "Slack notifications"].map((name) => (
                <div key={name} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">Not configured</p></div>
                  <Button variant="outline" size="sm" onClick={() => toast.info("Connect backend to manage secrets.")}>Configure</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspaces">
          <Card className="border-border/60 bg-surface-elevated">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4" /> Workspaces</CardTitle>
              <CardDescription>Workspaces isolate projects, records, and contacts by business line.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {["Hotel Lead Gen", "TEDx Opportunities", "NVRLand", "Client Outreach", "General Research"].map((w) => (
                <div key={w} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <p className="font-medium">{w}</p>
                  <Button size="sm" variant="ghost">Edit</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags">
          <Card className="border-border/60 bg-surface-elevated">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><TagIcon className="h-4 w-4" /> Tags</CardTitle>
              <CardDescription>Reusable labels applied to records, contacts, and projects.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Input placeholder="New tag…" />
                <Button onClick={() => toast.success("Tag added (mock)")}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => <TagChip key={t.id} label={t.label} />)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines">
          <Card className="border-border/60 bg-surface-elevated">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> Status pipelines</CardTitle>
              <CardDescription>Define the review states a record moves through.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {["new → in_review → approved/rejected", "new → flagged → resolved", "approved → complete"].map((p) => (
                <div key={p} className="rounded-md border border-border/60 p-3 font-mono text-xs">{p}</div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="border-border/60 bg-surface-elevated">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Users & roles</CardTitle>
              <CardDescription>Connect a backend to enable real authentication and role-based access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Default role</Label>
                <Input defaultValue="member" disabled />
              </div>
              <p className="text-xs text-muted-foreground">User management is locked until Lovable Cloud is connected.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
