"use client";

import { CalendarDays, Copy, DollarSign, Hash, KeyRound, Layers, Plus, Puzzle, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PlanDialog } from "@/components/catalog/dialogs";
import { formatLimit, formatPrice } from "@/components/catalog/format";
import { RecordIcon } from "@/components/catalog/record";
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
import { api } from "@/lib/api/client";
import { useApiMutation, useAppId, useEntitlements, usePlans } from "@/lib/api/hooks";
import type { Plan } from "@/lib/api/types";
import { useNewParam } from "@/lib/use-new-param";
import { usePlanAccountTotals } from "@/lib/use-plan-account-totals";
import { formatDate, formatNumber, pluralize } from "@/lib/utils";

export function PlansView() {
  const appId = useAppId();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: plans, isLoading } = usePlans(appId);
  const { data: entitlements } = useEntitlements(appId);
  const totals = usePlanAccountTotals(appId, plans?.map((p) => p.id) ?? []);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useNewParam();
  const [duplicateSource, setDuplicateSource] = useState<Plan | null>(null);

  const entName = useMemo(() => new Map(entitlements?.map((e) => [e.id, e])), [entitlements]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (plans ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.id.includes(q));
  }, [plans, query]);

  const remove = useApiMutation((id: string) => api.plans.delete(appId, id), { success: "Plan deleted" });

  const onDelete = async (plan: Plan) => {
    const count = totals[plan.id] ?? 0;
    await confirm({
      title: `Delete ${plan.name}?`,
      description:
        count > 0
          ? `${pluralize(count, "account")} ${count === 1 ? "is" : "are"} on this plan. Their access checks will fail until you move them to another plan.`
          : "This can't be undone.",
      typeToConfirm: count > 0 ? plan.id : undefined,
      confirmLabel: "Delete Plan",
      onConfirm: () => remove.mutateAsync(plan.id),
    });
  };

  return (
    <>
      <PageHeader
        icon={<Layers />}
        title="Plans"
        actions={
          <>
            <UseSdkApiButtons topic="plans" />
            <HowItWorksButton topic="plans" />
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus />
              New Plan
            </Button>
          </>
        }
      />
      <Toolbar>
        <InputGroup
          size="sm"
          leading={<Search />}
          placeholder="Search plans"
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
        ) : !plans?.length ? (
          <EmptyState
            icon={<Layers />}
            title="No plans yet"
            description="Plans bundle entitlements and limits. Every account is on exactly one plan."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus />
                Create Plan
              </Button>
            }
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH icon={<Layers />} className="min-w-48">
                      Plan
                    </TH>
                    <TH icon={<Hash />}>ID</TH>
                    <TH icon={<DollarSign />}>Price</TH>
                    <TH icon={<KeyRound />}>
                      Entitlements
                    </TH>
                    <TH icon={<Puzzle />}>Add-ons</TH>
                    <TH icon={<Users />} align="right">
                      Accounts
                    </TH>
                    <TH icon={<CalendarDays />}>Created</TH>
                    <TH className="w-10" />
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((plan) => {
                    const price = formatPrice(plan.pricingCard, plan.isFree);
                    return (
                      <TR key={plan.id} interactive onClick={() => router.push(`/apps/${appId}/plans/${plan.id}`)}>
                        <TD>
                          <div className="flex items-center gap-2">
                            <RecordIcon size="sm" tone={plan.isFree ? "green" : "blue"}>
                              <Layers />
                            </RecordIcon>
                            <span className="truncate font-medium">{plan.name}</span>
                            {plan.isFree ? <Badge color="green">Free</Badge> : null}
                            {plan.pricingCard?.featured ? <Badge color="brand">Featured</Badge> : null}
                          </div>
                        </TD>
                        <TD>
                          <IdTag>{plan.id}</IdTag>
                        </TD>
                        <TD className="tabular whitespace-nowrap">{price ?? <EmptyCell />}</TD>
                        <TD>
                          {plan.entitlements.length ? (
                            <div className="flex items-center gap-1.5">
                              {/* Chips clip; the "+N" count stays visible outside the clipped area. */}
                              <div className="flex max-w-[240px] items-center gap-1 overflow-hidden">
                                {plan.entitlements.slice(0, 2).map((e) => {
                                  const ent = entName.get(e.id);
                                  return (
                                    <Badge key={e.id} color="gray">
                                      {ent?.name ?? e.id}
                                      {ent?.type !== "boolean" ? (
                                        <span className="ml-0.5 text-fg-tertiary">{formatLimit(e.max)}</span>
                                      ) : null}
                                    </Badge>
                                  );
                                })}
                              </div>
                              {plan.entitlements.length > 2 ? (
                                <span className="shrink-0 text-xs text-fg-tertiary">+{plan.entitlements.length - 2}</span>
                              ) : null}
                            </div>
                          ) : (
                            <EmptyCell>None</EmptyCell>
                          )}
                        </TD>
                        <TD className="tabular">{plan.addons.length || <EmptyCell />}</TD>
                        <TD align="right">
                          {totals[plan.id] === undefined ? <EmptyCell /> : formatNumber(totals[plan.id])}
                        </TD>
                        <TD className="text-fg-secondary">{formatDate(plan.created_at)}</TD>
                        <TD className="px-1">
                          <RowMenu>
                            <MenuItem onClick={() => setDuplicateSource(plan)}>
                              <Copy />
                              Duplicate
                            </MenuItem>
                            <MenuItem onClick={() => navigator.clipboard.writeText(plan.id)}>
                              <Hash />
                              Copy ID
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem tone="danger" onClick={() => onDelete(plan)}>
                              <Trash2 />
                              Delete
                            </MenuItem>
                          </RowMenu>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
            <TableFooter>
              {query ? `${filtered.length} of ${pluralize(plans.length, "plan")}` : pluralize(plans.length, "plan")}
            </TableFooter>
          </>
        )}
      </PageBody>
      <PlanDialog appId={appId} open={createOpen} onOpenChange={setCreateOpen} />
      <PlanDialog
        appId={appId}
        open={Boolean(duplicateSource)}
        onOpenChange={(o) => !o && setDuplicateSource(null)}
        source={duplicateSource}
      />
    </>
  );
}
