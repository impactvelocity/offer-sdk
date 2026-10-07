"use client";

import { CalendarDays, FileText, Hash, KeyRound, Layers, Pencil, Plus, Search, ToggleRight, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EntitlementDialog } from "@/components/catalog/dialogs";
import { HowItWorksButton } from "@/components/catalog/how-it-works";
import { UseSdkApiButtons } from "@/components/catalog/use-sdk-api";
import { RowMenu } from "@/components/catalog/row-menu";
import { PageBody, PageHeader, Toolbar } from "@/components/shell/page";
import { Badge, IdTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup } from "@/components/ui/input";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { useApiMutation, useAppId, useEntitlements, useIncentives, usePlans } from "@/lib/api/hooks";
import type { Entitlement, EntitlementType } from "@/lib/api/types";
import { deleteEntitlement } from "@/lib/catalog-actions";
import { useNewParam } from "@/lib/use-new-param";
import { formatDate, pluralize } from "@/lib/utils";

export function EntitlementsView() {
  const appId = useAppId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirm = useConfirm();
  const { data: entitlements, isLoading } = useEntitlements(appId);
  const { data: plans = [] } = usePlans(appId);
  const { data: incentives = [] } = useIncentives(appId);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | EntitlementType>("all");
  const [createOpen, setCreateOpen] = useNewParam();
  const [editing, setEditing] = useState<Entitlement | null>(null);

  // ?focus=<id> (from quick actions) opens that entitlement once the list has loaded.
  const focus = params.get("focus");
  const [handledFocus, setHandledFocus] = useState<string | null>(null);
  if (entitlements && focus !== handledFocus) {
    setHandledFocus(focus);
    const match = focus ? entitlements.find((e) => e.id === focus) : undefined;
    if (match) setEditing(match);
  }
  useEffect(() => {
    if (focus && entitlements) router.replace(pathname, { scroll: false });
  }, [focus, entitlements, pathname, router]);

  const usage = useMemo(() => {
    const map = new Map<string, { plans: string[]; incentives: string[] }>();
    for (const e of entitlements ?? []) map.set(e.id, { plans: [], incentives: [] });
    for (const p of plans) for (const r of p.entitlements) map.get(r.id)?.plans.push(p.name);
    for (const i of incentives) for (const r of i.entitlements) map.get(r.id)?.incentives.push(i.name);
    return map;
  }, [entitlements, plans, incentives]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entitlements ?? []).filter(
      (e) => (type === "all" || e.type === type) && (!q || e.name.toLowerCase().includes(q) || e.id.includes(q)),
    );
  }, [entitlements, query, type]);

  const remove = useApiMutation((id: string) => deleteEntitlement(appId, id, plans, incentives), {
    success: "Entitlement deleted",
  });

  const onDelete = async (e: Entitlement) => {
    const used = usage.get(e.id);
    const refs = (used?.plans.length ?? 0) + (used?.incentives.length ?? 0);
    await confirm({
      title: `Delete ${e.name}?`,
      description:
        refs > 0
          ? `It will be removed from ${[
              used?.plans.length ? pluralize(used.plans.length, "plan") : null,
              used?.incentives.length ? pluralize(used.incentives.length, "incentive") : null,
            ]
              .filter(Boolean)
              .join(" and ")} first. Accounts lose it immediately, and usage stops being tracked.`
          : "This can't be undone.",
      typeToConfirm: refs > 0 ? e.id : undefined,
      confirmLabel: "Delete entitlement",
      onConfirm: () => remove.mutateAsync(e.id),
    });
  };

  const editingUsedIn = editing ? (usage.get(editing.id)?.plans.length ?? 0) + (usage.get(editing.id)?.incentives.length ?? 0) : 0;

  return (
    <>
      <PageHeader
        icon={<KeyRound />}
        title="Entitlements"
        actions={
          <>
            <UseSdkApiButtons topic="entitlements" />
            <HowItWorksButton topic="entitlements" />
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus />
              New entitlement
            </Button>
          </>
        }
      />
      <Toolbar>
        <InputGroup
          size="sm"
          leading={<Search />}
          placeholder="Search entitlements"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperClassName="w-64"
        />
        <Segmented
          value={type}
          onValueChange={setType}
          options={[
            { value: "all", label: "All" },
            { value: "usage", label: "Usage" },
            { value: "boolean", label: "Feature flags" },
          ]}
        />
      </Toolbar>
      <PageBody>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : !entitlements?.length ? (
          <EmptyState
            icon={<KeyRound />}
            title="No entitlements yet"
            description="Entitlements are the features and limits you gate: usage you count (projects, credits) or flags you switch on (SSO, exports)."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus />
                Create entitlement
              </Button>
            }
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH icon={<KeyRound />} className="min-w-52">
                      Entitlement
                    </TH>
                    <TH icon={<Hash />}>ID</TH>
                    <TH icon={<ToggleRight />}>Type</TH>
                    <TH icon={<FileText />} className="min-w-64">
                      Description
                    </TH>
                    <TH icon={<Layers />}>Used in</TH>
                    <TH icon={<CalendarDays />}>Created</TH>
                    <TH className="w-10" />
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((e) => {
                    const used = usage.get(e.id);
                    return (
                      <TR key={e.id} interactive onClick={() => setEditing(e)}>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-[5px] bg-bg-muted text-fg-tertiary [&_svg]:size-3">
                              {e.type === "usage" ? <Hash /> : <ToggleRight />}
                            </span>
                            <span className="truncate font-medium">{e.name}</span>
                          </div>
                        </TD>
                        <TD>
                          <IdTag>{e.id}</IdTag>
                        </TD>
                        <TD>{e.type === "usage" ? <Badge color="blue">Usage</Badge> : <Badge color="brand">Feature flag</Badge>}</TD>
                        <TD className="max-w-md">
                          {e.description ? <span className="line-clamp-1 text-fg-secondary">{e.description}</span> : <EmptyCell />}
                        </TD>
                        <TD>
                          {used && (used.plans.length || used.incentives.length) ? (
                            <Tooltip
                              content={
                                <span className="flex max-w-64 flex-col">
                                  {used.plans.length ? <span>Plans: {used.plans.join(", ")}</span> : null}
                                  {used.incentives.length ? <span>Incentives: {used.incentives.join(", ")}</span> : null}
                                </span>
                              }
                            >
                              <span className="inline-flex items-center gap-1">
                                {used.plans.length ? <Badge color="gray">{pluralize(used.plans.length, "plan")}</Badge> : null}
                                {used.incentives.length ? (
                                  <Badge color="orange">{pluralize(used.incentives.length, "incentive")}</Badge>
                                ) : null}
                              </span>
                            </Tooltip>
                          ) : (
                            <EmptyCell>Not used</EmptyCell>
                          )}
                        </TD>
                        <TD className="text-fg-secondary">{formatDate(e.created_at)}</TD>
                        <TD className="px-1">
                          <RowMenu>
                            <MenuItem onClick={() => setEditing(e)}>
                              <Pencil />
                              Edit
                            </MenuItem>
                            <MenuItem onClick={() => navigator.clipboard.writeText(e.id)}>
                              <Hash />
                              Copy ID
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem tone="danger" onClick={() => onDelete(e)}>
                              <Trash2 />
                              Delete
                            </MenuItem>
                          </RowMenu>
                        </TD>
                      </TR>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="h-24 border-b border-border text-center text-sm text-fg-tertiary">
                        No entitlements match your filters.
                      </td>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </TableContainer>
            <TableFooter>
              {filtered.length !== entitlements.length
                ? `${filtered.length} of ${pluralize(entitlements.length, "entitlement")}`
                : pluralize(entitlements.length, "entitlement")}
            </TableFooter>
          </>
        )}
      </PageBody>
      <EntitlementDialog appId={appId} open={createOpen} onOpenChange={setCreateOpen} />
      <EntitlementDialog
        appId={appId}
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        entitlement={editing}
        usedIn={editingUsedIn}
      />
    </>
  );
}
