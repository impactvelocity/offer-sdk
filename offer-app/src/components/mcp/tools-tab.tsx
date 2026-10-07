"use client";

import { Ban, ChevronRight, FileText, MessageSquareText, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { InlineCode, Md, MethodBadge, PathText } from "@/components/developers/bits";
import { GROUPS, type GroupId } from "@/components/developers/endpoints";
import { RefLink } from "@/components/developers/guide-layout";
import {
  ACCESS_LEVELS,
  EXCLUDED_ENDPOINTS,
  MCP_PROMPTS,
  MCP_RESOURCES,
  MCP_TOOLS,
  type AccessLevel,
  type McpTool,
} from "@/components/developers/mcp-tools";
import { fillExample, type Examples } from "@/components/developers/use-dev-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardHeader } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn, pluralize } from "@/lib/utils";
import { KindBadge } from "./bits";

export function ToolsTab({
  appId,
  examples,
  enabled,
  level,
  onLevelChange,
  overrides,
  onToggle,
  onResetOverrides,
  isToolOn,
}: {
  appId: string;
  examples: Examples;
  enabled: boolean;
  level: AccessLevel;
  onLevelChange: (level: AccessLevel) => void;
  overrides: Record<string, boolean>;
  onToggle: (name: string, on: boolean) => void;
  onResetOverrides: () => void;
  isToolOn: (name: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"all" | GroupId>("all");
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = MCP_TOOLS.filter(
      (t) =>
        (group === "all" || t.endpoint.group === group) &&
        (!q || t.name.includes(q) || t.title.toLowerCase().includes(q) || t.endpoint.path.toLowerCase().includes(q)),
    );
    return GROUPS.map((g) => ({ ...g, tools: matches.filter((t) => t.endpoint.group === g.id) })).filter((g) => g.tools.length);
  }, [query, group]);

  const overrideCount = Object.keys(overrides).length;
  const levelInfo = ACCESS_LEVELS.find((l) => l.value === level);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-fg">Default access for new connections</h3>
            <p className="mt-0.5 text-sm text-fg-tertiary">{levelInfo?.description}</p>
          </div>
          <Segmented<AccessLevel>
            value={level}
            onValueChange={onLevelChange}
            options={ACCESS_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
          />
        </div>
        {overrideCount ? (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-bg-subtle px-5 py-2.5 text-sm text-fg-secondary">
            <span>{pluralize(overrideCount, "tool")} set by hand, ignoring the access level.</span>
            <Button size="xs" variant="ghost" onClick={onResetOverrides}>
              Reset to defaults
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup
          size="sm"
          leading={<Search />}
          placeholder="Search tools, paths and summaries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperClassName="w-full sm:w-72"
        />
        <Select<"all" | GroupId>
          size="sm"
          className="w-44"
          aria-label="Group"
          value={group}
          onValueChange={setGroup}
          options={[{ value: "all", label: "All groups" }, ...GROUPS.map((g) => ({ value: g.id, label: g.title }))]}
        />
        <span className="ml-auto text-sm text-fg-tertiary">
          {MCP_TOOLS.filter((t) => isToolOn(t.name)).length} of {MCP_TOOLS.length} tools on
        </span>
      </div>

      {!groups.length ? (
        <Card>
          <EmptyState
            compact
            icon={<SearchX />}
            title="No tools match"
            description="Try a resource like “plan” or a verb like “create”."
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  setGroup("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`tools-${g.id}`} className="border-b border-border last:border-b-0">
              <div className="flex items-baseline gap-3 border-b border-border bg-bg-subtle px-5 py-2">
                <h3 id={`tools-${g.id}`} className="shrink-0 text-sm font-semibold text-fg">
                  {g.title}
                </h3>
                <p className="hidden min-w-0 flex-1 truncate text-xs text-fg-tertiary sm:block">{g.description.replace(/`/g, "")}</p>
                <span className="ml-auto shrink-0 text-xs tabular text-fg-tertiary">
                  {g.tools.filter((t) => isToolOn(t.name)).length}/{g.tools.length} on
                </span>
              </div>
              {g.tools.map((t) => (
                <ToolRow
                  key={t.name}
                  tool={t}
                  appId={appId}
                  examples={examples}
                  open={open === t.name}
                  onOpenChange={(next) => setOpen(next ? t.name : null)}
                  on={isToolOn(t.name)}
                  overridden={t.name in overrides}
                  disabled={!enabled}
                  onToggle={(on) => onToggle(t.name, on)}
                />
              ))}
            </section>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-fg-icon" />
                Resources
              </span>
            }
            description="Read-only context clients can attach to a conversation."
          />
          <ul className="divide-y divide-border">
            {MCP_RESOURCES.map((r) => (
              <li key={r.uri} className="flex flex-col gap-1 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-[13px] text-fg">{r.uri}</code>
                  <span className="text-sm text-fg-tertiary">{r.name}</span>
                </div>
                <p className="text-sm text-fg-secondary">{r.description}</p>
                <p className="font-mono text-[11.5px] text-fg-tertiary">{r.routes.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MessageSquareText className="size-4 text-fg-icon" />
                Prompts
              </span>
            }
            description="Ready-made workflows that show up as slash commands in most clients."
          />
          <ul className="divide-y divide-border">
            {MCP_PROMPTS.map((p) => (
              <li key={p.name} className="flex flex-col gap-1 px-5 py-3">
                <code className="text-[13px] text-fg">/{p.name}</code>
                <p className="text-sm text-fg-secondary">{p.description}</p>
                {p.arguments.length ? (
                  <div className="flex flex-wrap gap-1">
                    {p.arguments.map((a) => (
                      <InlineCode key={a.name} className="text-[11.5px] text-fg-secondary">
                        {a.name}
                        {a.required ? "" : "?"}
                      </InlineCode>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Ban className="size-4 text-fg-icon" />
              Not available over MCP
            </span>
          }
          description="These endpoints could lock out your product, so they stay in the dashboard and the API."
        />
        <ul className="divide-y divide-border">
          {EXCLUDED_ENDPOINTS.map(({ endpoint, reason }) => (
            <li key={`${endpoint.method} ${endpoint.path}`} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex min-w-0 items-center gap-2 sm:w-[360px] sm:shrink-0">
                <MethodBadge method={endpoint.method} />
                <PathText path={endpoint.path} dimPrefix className="min-w-0 truncate" />
              </span>
              <span className="text-sm text-fg-secondary">{reason}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ToolRow({
  tool,
  appId,
  examples,
  open,
  onOpenChange,
  on,
  overridden,
  disabled,
  onToggle,
}: {
  tool: McpTool;
  appId: string;
  examples: Examples;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  on: boolean;
  overridden: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <div className={cn("border-b border-border last:border-b-0", open && "bg-bg-subtle")}>
      <div className="flex items-center gap-3 pr-5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="flex h-12 min-w-0 flex-1 items-center gap-3 pl-5 text-left outline-none transition-colors hover:bg-bg-subtle focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
        >
          <ChevronRight className={cn("size-3.5 shrink-0 text-fg-tertiary transition-transform", open && "rotate-90")} />
          <code className={cn("shrink-0 text-[13.5px]", on ? "text-fg" : "text-fg-placeholder")}>{tool.name}</code>
          <span className="hidden min-w-0 flex-1 truncate text-sm text-fg-tertiary md:block">{tool.title}</span>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 sm:flex">
            {tool.endpoint.proposed ? <Badge color="brand">Proposed</Badge> : null}
            {overridden ? <Badge color="gray">Custom</Badge> : null}
            <KindBadge kind={tool.kind} />
          </span>
        </button>
        <Switch checked={on} disabled={disabled} onCheckedChange={onToggle} aria-label={`Allow ${tool.name}`} />
      </div>
      {open ? <ToolDetails tool={tool} appId={appId} examples={examples} /> : null}
    </div>
  );
}

function ToolDetails({ tool, appId, examples }: { tool: McpTool; appId: string; examples: Examples }) {
  const call = useMemo(
    () => JSON.stringify({ name: tool.name, arguments: fillExample(tool.exampleArgs, examples) }, null, 2),
    [tool, examples],
  );
  const e = tool.endpoint;
  return (
    <div className="flex flex-col gap-4 px-5 pb-6 pt-1 sm:pl-[46px]">
      <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
        {e.proposed ? <Badge color="brand">Proposed</Badge> : null}
        <KindBadge kind={tool.kind} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg">{tool.title}</p>
        {e.description ? (
          <p className="text-sm text-fg-secondary">
            <Md>{e.description}</Md>
          </p>
        ) : null}
        {tool.note ? (
          <Callout>
            <Md>{tool.note}</Md>
          </Callout>
        ) : null}
        {e.warning ? (
          <Callout tone="warning">
            <Md>{e.warning}</Md>
          </Callout>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CodeBlock title="Input schema" lang="json" maxHeight={320} code={JSON.stringify(tool.inputSchema, null, 2)} />
        <CodeBlock title="Example call" lang="json" maxHeight={320} code={call} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex flex-wrap items-center gap-1.5">
          {Object.entries(tool.annotations).map(([k, v]) => (
            <InlineCode key={k} className={cn("text-[11.5px]", v ? "text-fg" : "text-fg-placeholder")}>
              {k}: {String(v)}
            </InlineCode>
          ))}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-fg-tertiary">
          Calls
          <RefLink appId={appId} method={e.method} path={e.path} />
        </span>
      </div>
    </div>
  );
}
