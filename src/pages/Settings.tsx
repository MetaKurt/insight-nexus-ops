import { toast } from "sonner";
import { Database, Key, Users as UsersIcon, Tag as TagIcon, ListChecks, Boxes } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagChip } from "@/components/TagChip";
import { tags, workspaces } from "@/mocks/data";

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
                <div className="rounded-md bg-success/15 p-2 text-success"><Database className="h-5 w-5" /></div>
                <div>
                  <CardTitle className="text-base">Supabase backend connected</CardTitle>
                  <CardDescription>SignalHub is using Supabase for auth, jobs, workers, logs, findings, contacts, and missions.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Current backend services:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Authenticated dashboard access</li>
                  <li>Persistent job queue, worker status, and live job logs</li>
                  <li>Persistent findings, contacts, and mission stages</li>
                  <li>Supabase Edge Functions for mission planning and email verification</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="border-border/60 bg-surface-elevated">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> API integrations</CardTitle>
              <CardDescription>Third-party API keys are configured on the server and Supabase Edge Functions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {["OpenAI", "LinkedIn enrichment", "Crunchbase", "Slack notifications"].map((name) => (
                <div key={name} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">Not configured</p></div>
                  <Button variant="outline" size="sm" onClick={() => toast.info("Manage secrets on the server or in Supabase project settings.")}>Configure</Button>
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
              {workspaces.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <p className="font-medium">{w.name}</p>
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
              <CardDescription>Authentication is managed in Supabase Auth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Default role</Label>
                <Input defaultValue="member" disabled />
              </div>
              <p className="text-xs text-muted-foreground">Create and manage users in the Supabase dashboard.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
