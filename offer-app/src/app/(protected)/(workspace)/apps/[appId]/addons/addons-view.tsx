"use client";

import { CalendarDays, FileText, Hash, Layers, Pencil, Plus, Puzzle, Search, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddonDialog } from "@/components/catalog/dialogs";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { useAddons, useApiMutation, useAppId, useIncentives, usePlans } from "@/lib/api/hooks";
import type { Addon } from "@/lib/api/types";
import { deleteAddon } from "@/lib/catalog-actions";
import { useNewParam } from "@/lib/use-new-param";
import { formatDate, pluralize } from "@/lib/utils";

export function AddonsView() {
  const appId = useAppId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirm = useConfirm();
  const { data: addons, isLoading, error } = useAddons(appId);
  const { data: plans = [] } = usePlans(appId);
  const { data: incentives = [] } = useIncentives(appId);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useNewParam();
  const [editing, setEditing] = useState<Addon | null>(null);

  // ?focus=<id> (from quick actions) opens that add-on once the list has loaded.
  const focus = params.get("focus");
  const [handledFocus, setHandledFocus] = useState<string | null>(null);
  if (addons && focus !== handledFocus) {
    setHandledFocus(focus);
    const match = focus ? addons.find((a) => a.id === focus) : undefined;
    if (match) setEditing(match);
  }
  useEffect(() => {
    if (focus && addons) router.replace(pathname, { scroll: false });
  }, [focus, addons, pathname, router]);

  const usage = useMemo(() => {
    const map = new Map<string, { plans: string[]; incentives: string[] }>();
    for (const a of addons ?? []) map.set(a.id, { plans: [], incentives: [] });
    for (const p of plans) for (const id of p.addons) map.get(id)?.plans.push(p.name);
    for (const i of incentives) for (const id of i.addons) map.get(id)?.incentives.push(i.name);
    return map;
  }, [addons, plans, incentives]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (addons ?? []).filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.id.includes(q) || a.description?.toLowerCase().includes(q),
    );
  }, [addons, query]);

  const remove = useApiMutation((id: string) => deleteAddon(appId, id, plans, incentives), { success: "Add-on deleted" });

  const onDelete = async (addon: Addon) => {
    const used = usage.get(addon.id);
    const refs = (used?.plans.length ?? 0) + (used?.incentives.length ?? 0);
    await confirm({
      title: `Delete ${addon.name}?`,
      description:
        refs > 0
          ? `It will be removed from ${[
              used?.plans.length ? pluralize(used.plans.length, "plan") : null,
              used?.incentives.length ? pluralize(used.incentives.length, "incentive") : null,
            ]
              .filter(Boolean)
              .join(" and ")} first. Accounts stop receiving it in their addons immediately.`
          : "This can't be undone.",
      typeToConfirm: refs > 0 ? addon.id : undefined,
      confirmLabel: "Delete add-on",
      onConfirm: () => remove.mutateAsync(addon.id),
    });
  };

  return (
    <>
      <PageHeader
        icon={<Puzzle />}
        title="Add-ons"
        actions={
          <>
            <UseSdkApiButtons topic="addons" />
            <HowItWorksButton topic="addons" />
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus />
              New add-on
            </Button>
          </>
        }
      />
      <Toolbar>
        <InputGroup
          size="sm"
          leading={<Search />}
          placeholder="Search add-ons"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperClassName="w-64"
        />
      </Toolbar>
      <PageBody>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={<Puzzle />} title="Couldn't load add-ons" description={error.message} />
        ) : !addons?.length ? (
          <EmptyState
            icon={<Puzzle />}
            title="No add-ons yet"
            description="Add-ons are optional extras, like an extra storage pack or white-label branding. Attach them to plans or incentives and your app receives them in addons."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus />
                Create add-on
              </Button>
            }
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH icon={<Puzzle />} className="min-w-52">
                      Add-on
                    </TH>
                    <TH icon={<Hash />}>ID</TH>
                    <TH icon={<FileText />} className="min-w-64">
                      Description
                    </TH>
                    <TH icon={<Layers />}>Used in</TH>
                    <TH icon={<CalendarDays />}>Created</TH>
                    <TH className="w-10" />
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((a) => {
                    const used = usage.get(a.id);
                    return (
                      <TR key={a.id} interactive onClick={() => setEditing(a)}>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-[5px] bg-bg-muted text-fg-tertiary [&_svg]:size-3">
                              <Puzzle />
                            </span>
                            <span className="truncate font-medium">{a.name}</span>
                          </div>
                        </TD>
                        <TD>
                          <IdTag>{a.id}</IdTag>
                        </TD>
                        <TD className="max-w-md">
                          {a.description ? (
                            <span className="line-clamp-1 text-fg-secondary">{a.description}</span>
                          ) : (
                            <EmptyCell />
                          )}
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
                        <TD className="text-fg-secondary">{formatDate(a.created_at)}</TD>
                        <TD className="px-1">
                          <RowMenu>
                            <MenuItem onClick={() => setEditing(a)}>
                              <Pencil />
                              Edit
                            </MenuItem>
                            <MenuItem onClick={() => navigator.clipboard.writeText(a.id)}>
                              <Hash />
                              Copy ID
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem tone="danger" onClick={() => onDelete(a)}>
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
                      <td colSpan={6} className="h-24 border-b border-border text-center text-sm text-fg-tertiary">
                        No add-ons match “{query.trim()}”.
                      </td>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </TableContainer>
            <TableFooter>
              {filtered.length !== addons.length
                ? `${filtered.length} of ${pluralize(addons.length, "add-on")}`
                : pluralize(addons.length, "add-on")}
            </TableFooter>
          </>
        )}
      </PageBody>
      <AddonDialog appId={appId} open={createOpen} onOpenChange={setCreateOpen} />
      <AddonDialog appId={appId} open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} addon={editing} />
    </>
  );
}
