"use client";

import { Activity, Braces, Link2, Plug, Unplug, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CopyField } from "@/components/developers/bits";
import { levelAllows, MCP_PROMPTS, MCP_RESOURCES, MCP_TOOLS, type AccessLevel } from "@/components/developers/mcp-tools";
import { useDevContext } from "@/components/developers/use-dev-context";
import { ConnectTab } from "@/components/mcp/connect-tab";
import { ActivityTab, ConnectionsTab } from "@/components/mcp/connections-tab";
import { sampleActivity, sampleConnections } from "@/components/mcp/sample-data";
import { ToolsTab } from "@/components/mcp/tools-tab";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Badge, StatusDot } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import { cn, pluralize } from "@/lib/utils";

type TabId = "connect" | "tools" | "connections" | "activity";

// Mock UI: server state lives in this component until the MCP server and its endpoints exist.
export function McpView() {
  const ctx = useDevContext();
  const session = useSession();
  const [tab, setTab] = useState<TabId>("connect");
  const [enabled, setEnabled] = useState(true);
  const [level, setLevel] = useState<AccessLevel>("write");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [revoked, setRevoked] = useState<Set<string>>(() => new Set());
  const [now] = useState(() => Date.now());

  const isToolOn = useCallback(
    (name: string) => {
      const tool = MCP_TOOLS.find((t) => t.name === name);
      return Boolean(enabled && tool && (overrides[name] ?? levelAllows(level, tool.kind)));
    },
    [enabled, level, overrides],
  );

  const toggleTool = (name: string, on: boolean) => {
    const tool = MCP_TOOLS.find((t) => t.name === name);
    setOverrides((prev) => {
      const next = { ...prev };
      // Back to matching the access level: drop the override instead of storing it.
      if (tool && levelAllows(level, tool.kind) === on) delete next[name];
      else next[name] = on;
      return next;
    });
  };

  const user = session.data?.user;
  const allConnections = useMemo(
    () => sampleConnections(now, user ? { name: user.name || user.email, email: user.email } : undefined),
    [now, user],
  );
  const connections = allConnections.filter((c) => !revoked.has(c.id));
  const activity = useMemo(() => sampleActivity(now, ctx.examples), [now, ctx.examples]);

  const url = ctx.baseUrl ? `${ctx.baseUrl}/apps/${ctx.appId}/mcp` : "";
  const toolsOn = MCP_TOOLS.filter((t) => isToolOn(t.name)).length;
  const usageName = ctx.entitlements.find((e) => e.id === ctx.examples.usageEntitlement)?.name ?? "AI credits";
  const ready = !ctx.isLoading && Boolean(ctx.app);

  return (
    <>
      <PageHeader
        icon={<Plug />}
        title="MCP server"
        badge={<Badge color="purple">Preview</Badge>}
        actions={
          <Link href={`/apps/${ctx.appId}/developers/api`} className={buttonVariants()}>
            <Braces />
            API reference
          </Link>
        }
      />
      <PageBody width="wide">
        {!ready ? (
          ctx.error ? (
            <Callout tone="danger" title="Couldn't load this app">
              {ctx.error.message}
            </Callout>
          ) : (
            <div className="flex flex-col gap-6">
              <Skeleton className="h-44" />
              <Skeleton className="h-10 w-96" />
              <Skeleton className="h-96" />
            </div>
          )
        ) : (
          <>
            <ServerCard
              appName={ctx.app?.name ?? "this app"}
              url={url}
              mock={ctx.mode === "mock"}
              enabled={enabled}
              onEnabledChange={setEnabled}
              toolsOn={toolsOn}
              connections={connections.length}
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="mt-6">
              <TabsList className="px-0">
                <Tab value="connect" icon={<Link2 />}>
                  Connect
                </Tab>
                <Tab value="tools" icon={<Wrench />} count={toolsOn}>
                  Tools
                </Tab>
                <Tab value="connections" icon={<Unplug />} count={connections.length}>
                  Connections
                </Tab>
                <Tab value="activity" icon={<Activity />}>
                  Activity
                </Tab>
              </TabsList>
              <TabsPanel value="connect" className="pt-6">
                <ConnectTab url={url} examples={ctx.examples} usageName={usageName} isToolOn={isToolOn} />
              </TabsPanel>
              <TabsPanel value="tools" className="pt-6">
                <ToolsTab
                  appId={ctx.appId}
                  examples={ctx.examples}
                  enabled={enabled}
                  level={level}
                  onLevelChange={setLevel}
                  overrides={overrides}
                  onToggle={toggleTool}
                  onResetOverrides={() => setOverrides({})}
                  isToolOn={isToolOn}
                />
              </TabsPanel>
              <TabsPanel value="connections" className="pt-6">
                <ConnectionsTab
                  connections={connections}
                  onRevoke={(id) => setRevoked((prev) => new Set(prev).add(id))}
                />
              </TabsPanel>
              <TabsPanel value="activity" className="pt-6">
                <ActivityTab calls={activity} connections={allConnections} />
              </TabsPanel>
            </Tabs>
          </>
        )}
      </PageBody>
    </>
  );
}

function ServerCard({
  appName,
  url,
  mock,
  enabled,
  onEnabledChange,
  toolsOn,
  connections,
}: {
  appName: string;
  url: string;
  mock: boolean;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  toolsOn: number;
  connections: number;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 bg-brand-glow p-5 sm:flex-row sm:items-start">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm [&_svg]:size-5">
          <Plug />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-display text-lg font-semibold text-fg">Offer MCP server</h2>
            {enabled ? <StatusDot color="green">Live</StatusDot> : <StatusDot color="gray">Off</StatusDot>}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-fg-secondary">
            Connect Claude, Cursor and other AI assistants to {appName}. They can look up accounts and change plans, limits and
            offers through the same API your product uses, scoped to this app.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-bg px-3 py-2 shadow-xs">
          <span className="text-sm font-medium text-fg">Enabled</span>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label="Enable the MCP server" />
        </label>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-border px-5 py-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-fg-tertiary">
          Server URL
          {mock ? <Badge color="orange">Mock API</Badge> : null}
        </span>
        <CopyField value={url} />
      </div>
      <div className="grid grid-cols-1 border-t border-border sm:grid-cols-3">
        <Fact label="Transport">Streamable HTTP</Fact>
        <Fact label="Tools on">
          {toolsOn} <span className="text-fg-tertiary">of {MCP_TOOLS.length}</span>
        </Fact>
        <Fact label="Also serves">
          {pluralize(MCP_RESOURCES.length, "resource")}, {pluralize(MCP_PROMPTS.length, "prompt")} ·{" "}
          {pluralize(connections, "connection")}
        </Fact>
      </div>
      {!enabled ? (
        <div className="border-t border-border px-5 py-3">
          <Callout tone="warning" title="The server is off">
            Connected clients get an error on their next call and their tools disappear. Connections are kept, so turning it back
            on restores them.
          </Callout>
        </div>
      ) : null}
    </Card>
  );
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 border-t border-border px-5 py-3.5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0", className)}>
      <span className="text-xs font-medium text-fg-tertiary">{label}</span>
      <span className="text-sm font-medium text-fg">{children}</span>
    </div>
  );
}
