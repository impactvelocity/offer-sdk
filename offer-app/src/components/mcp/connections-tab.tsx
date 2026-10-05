"use client";

import { ChevronRight, Unplug } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { MCP_TOOLS } from "@/components/developers/mcp-tools";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Table, TableContainer, TBody, TD, TH, THead } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { cn, formatDateTime, formatNumber, formatRelative } from "@/lib/utils";
import { AccessBadge, ClientIcon, KindBadge, statusColor } from "./bits";
import type { McpCall, McpConnection } from "./sample-data";

export function ConnectionsTab({
  connections,
  onRevoke,
}: {
  connections: McpConnection[];
  onRevoke: (id: string) => void;
}) {
  const confirm = useConfirm();

  const revoke = (c: McpConnection) =>
    confirm({
      title: `Disconnect ${c.label}?`,
      description:
        c.auth === "key"
          ? `${c.label} is removed from this list, but the secret key it uses keeps working until you rotate it in API keys.`
          : `${c.user.name}'s ${c.label} loses access on its next call. They can reconnect by signing in again.`,
      confirmLabel: "Disconnect",
      tone: "danger",
      onConfirm: () => {
        onRevoke(c.id);
        toast.success(`${c.label} disconnected`);
      },
    });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Connections"
        description="People and tools connected to this app's MCP server. Revoking takes effect on the next call."
      />
      {!connections.length ? (
        <EmptyState
          compact
          icon={<Unplug />}
          title="Nothing connected"
          description="Connect Claude, Cursor or another client from the Connect tab and it shows up here."
        />
      ) : (
        <TableContainer className="[&_tbody_tr:last-child>td]:border-b-0">
          <Table>
            <THead className="static bg-bg-subtle">
              <tr>
                <TH className="h-9 text-xs">Client</TH>
                <TH className="hidden h-9 text-xs xl:table-cell">Connected by</TH>
                <TH className="h-9 text-xs">Access</TH>
                <TH className="hidden h-9 text-xs 2xl:table-cell">Last used</TH>
                <TH className="hidden h-9 text-xs xl:table-cell" align="right">
                  Calls (7d)
                </TH>
                <TH className="h-9 w-0 text-xs">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {connections.map((c) => (
                <tr key={c.id}>
                  <TD className="h-14">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ClientIcon client={c.client} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-fg">{c.label}</span>
                        <span className="block text-xs text-fg-tertiary">
                          <span className="xl:hidden">{c.user.name} · </span>
                          {c.auth === "oauth" ? "OAuth" : "Secret key"} · used {formatRelative(c.lastUsedAt)}
                        </span>
                      </span>
                    </span>
                  </TD>
                  <TD className="hidden xl:table-cell">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={c.user.name} seed={c.user.email} size="md" shape="circle" />
                      <span className="min-w-0">
                        <span className="block truncate text-fg">{c.user.name}</span>
                        <span className="block truncate text-xs text-fg-tertiary">{c.user.email}</span>
                      </span>
                    </span>
                  </TD>
                  <TD>
                    <AccessBadge access={c.access} />
                  </TD>
                  <TD className="hidden whitespace-nowrap text-fg-secondary 2xl:table-cell">{formatRelative(c.lastUsedAt)}</TD>
                  <TD align="right" className="hidden xl:table-cell">
                    {formatNumber(c.calls7d)}
                  </TD>
                  <TD>
                    <Button size="xs" variant="danger-ghost" onClick={() => revoke(c)}>
                      Disconnect
                    </Button>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}

type Filter = "all" | "writes" | "errors";

export function ActivityTab({ calls, connections }: { calls: McpCall[]; connections: McpConnection[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const kindOf = (tool: string) => MCP_TOOLS.find((t) => t.name === tool)?.kind ?? "read";
  const byId = useMemo(() => new Map(connections.map((c) => [c.id, c])), [connections]);

  const rows = calls.filter((c) =>
    filter === "writes" ? kindOf(c.tool) !== "read" : filter === "errors" ? c.status >= 400 : true,
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Activity"
        description="Every tool call, with its arguments and what the API returned."
        actions={
          <Segmented<Filter>
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "writes", label: "Changes" },
              { value: "errors", label: "Errors" },
            ]}
          />
        }
      />
      {!rows.length ? (
        <EmptyState compact icon={<Unplug />} title="No calls" description="Nothing matches this filter yet." />
      ) : (
        <TableContainer className="[&_tbody_tr:last-child>td]:border-b-0">
          <Table>
            <THead className="static bg-bg-subtle">
              <tr>
                <TH className="h-9 text-xs">Tool</TH>
                <TH className="hidden h-9 text-xs xl:table-cell">Arguments</TH>
                <TH className="hidden h-9 text-xs 2xl:table-cell">Client</TH>
                <TH className="h-9 text-xs">Status</TH>
                <TH className="h-9 text-xs" align="right">
                  When
                </TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => {
                const conn = byId.get(c.connectionId);
                const expanded = open === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      className={cn("cursor-pointer [&>td]:hover:bg-bg-subtle", expanded && "[&>td]:bg-bg-subtle")}
                      onClick={() => setOpen(expanded ? null : c.id)}
                    >
                      <TD>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          className="flex items-center gap-2 rounded-md text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
                        >
                          <ChevronRight className={cn("size-3.5 shrink-0 text-fg-tertiary transition-transform", expanded && "rotate-90")} />
                          <code className="text-[13px] text-fg">{c.tool}</code>
                          {kindOf(c.tool) !== "read" ? <KindBadge kind={kindOf(c.tool)} /> : null}
                        </button>
                      </TD>
                      <TD className="hidden max-w-72 xl:table-cell">
                        <span className="block truncate font-mono text-xs text-fg-secondary">{argSummary(c.args)}</span>
                      </TD>
                      <TD className="hidden 2xl:table-cell">
                        {conn ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <ClientIcon client={conn.client} size="sm" />
                            <span className="truncate text-fg-secondary">{conn.user.name.split(" ")[0]}</span>
                          </span>
                        ) : (
                          <span className="text-fg-tertiary">Disconnected</span>
                        )}
                      </TD>
                      <TD>
                        <span className="flex items-center gap-2">
                          <Badge color={statusColor(c.status)} className="font-mono">
                            {c.status}
                          </Badge>
                          <span className="hidden whitespace-nowrap text-xs tabular text-fg-tertiary xl:inline">{c.durationMs} ms</span>
                        </span>
                      </TD>
                      <TD align="right" className="whitespace-nowrap text-fg-secondary">
                        <span title={formatDateTime(c.at)}>{formatRelative(c.at)}</span>
                      </TD>
                    </tr>
                    {expanded ? (
                      <tr>
                        <TD colSpan={5} className="h-auto bg-bg-subtle py-4">
                          <p className="mb-3 text-xs text-fg-tertiary">
                            {conn ? `${conn.user.name} via ${conn.label}` : "A disconnected client"} · {formatDateTime(c.at)} ·{" "}
                            {c.durationMs} ms
                          </p>
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <CodeBlock title="Arguments" lang="json" maxHeight={260} code={JSON.stringify(c.args, null, 2)} />
                            <CodeBlock title="Result" lang="json" maxHeight={260} code={JSON.stringify(c.result, null, 2)} />
                          </div>
                        </TD>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}

function argSummary(args: Record<string, unknown>) {
  const entries = Object.entries(args);
  if (!entries.length) return "—";
  return entries.map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ");
}
