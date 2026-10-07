"use client";

import { ArrowRight, Hash, Layers, Plus, Puzzle, ToggleRight, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatLimit } from "@/components/catalog/format";
import { RecordIcon } from "@/components/catalog/record";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import type { Addon, Entitlement, EntitlementRef, Incentive, Plan } from "@/lib/api/types";

/** Compact override chips for list rows: "AI credits 5,000", "Projects Unlimited", "SSO". */
export function OverrideBadges({
  incentive,
  entitlements,
  limit = 3,
}: {
  incentive: Incentive;
  entitlements: Entitlement[];
  limit?: number;
}) {
  if (!incentive.entitlements.length) return <EmptyCell>None</EmptyCell>;
  const byId = new Map(entitlements.map((e) => [e.id, e]));
  return (
    <div className="flex max-w-md items-center gap-1 overflow-hidden">
      {incentive.entitlements.slice(0, limit).map((ref) => {
        const ent = byId.get(ref.id);
        return (
          <Badge key={ref.id} color="gray">
            {ent?.name ?? ref.id}
            {ent?.type !== "boolean" ? <span className="ml-0.5 text-fg-tertiary">{formatLimit(ref.max)}</span> : null}
          </Badge>
        );
      })}
      {incentive.entitlements.length > limit ? (
        <span className="shrink-0 text-xs text-fg-tertiary">+{incentive.entitlements.length - limit}</span>
      ) : null}
    </div>
  );
}

type Change = { kind: "same"; value: string } | { kind: "raise" | "lower" | "grant"; from: string; to: string };

/** What an override does to one plan's entitlement, mirroring how the API merges them. */
function changeFor(planRef: EntitlementRef | undefined, override: EntitlementRef, type: Entitlement["type"]): Change {
  if (type === "boolean")
    return planRef ? { kind: "same", value: "Included" } : { kind: "grant", from: "Not included", to: "Included" };
  const to = override.max ?? null;
  if (!planRef) return { kind: "grant", from: "Not included", to: formatLimit(to) };
  const from = planRef.max ?? null;
  if (from === to) return { kind: "same", value: formatLimit(from) };
  const lower = to !== null && (from === null || to < from);
  return { kind: lower ? "lower" : "raise", from: formatLimit(from), to: formatLimit(to) };
}

function ChangeCell({ change, planName }: { change: Change; planName: string }) {
  if (change.kind === "same") {
    return (
      <Tooltip content={`Unchanged: ${planName} already has ${change.value}`}>
        <span className="text-fg-placeholder">—</span>
      </Tooltip>
    );
  }
  const to =
    change.kind === "lower" ? (
      <Tooltip content={`Lower than ${planName}'s own limit`}>
        <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
          <TrendingDown className="size-3.5" />
          {change.to}
        </span>
      </Tooltip>
    ) : change.kind === "raise" ? (
      <Tooltip content={`Higher than ${planName}'s own limit`}>
        <span className="inline-flex items-center gap-1 font-medium text-success-fg">
          <TrendingUp className="size-3.5" />
          {change.to}
        </span>
      </Tooltip>
    ) : (
      <Tooltip content={`Not on ${planName} before`}>
        <span className="inline-flex items-center gap-1 font-medium text-success-fg">
          <Plus className="size-3.5" />
          {change.to}
        </span>
      </Tooltip>
    );
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular">
      <span className="text-fg-tertiary">{change.from}</span>
      <ArrowRight className="size-3 shrink-0 text-fg-placeholder" />
      {to}
    </span>
  );
}

/**
 * Plans × overridden entitlements: what accounts on each plan actually get once this incentive
 * is applied. Computed client-side with the same rules the API uses to resolve access.
 */
export function ImpactByPlan({
  appId,
  incentive,
  plans,
  entitlements,
  addons,
  loading,
}: {
  appId: string;
  incentive: Incentive;
  plans: Plan[];
  entitlements: Entitlement[];
  addons: Addon[];
  loading?: boolean;
}) {
  const router = useRouter();
  const entById = new Map(entitlements.map((e) => [e.id, e]));
  const addonName = new Map(addons.map((a) => [a.id, a.name]));
  const touches = incentive.entitlements.length + incentive.addons.length;

  const header = (
    <CardHeader
      title="Impact by Plan"
      description="What accounts on each plan get once this incentive is applied. Their plan itself doesn't change."
    />
  );

  if (loading) {
    return (
      <Card>
        {header}
        <div className="flex flex-col gap-2 p-6">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </Card>
    );
  }

  if (!touches || !plans.length) {
    return (
      <Card>
        {header}
        <p className="px-5 py-5 text-sm text-fg-tertiary">
          {!plans.length ? (
            <>
              There are no plans to compare against yet.{" "}
              <Link href={`/apps/${appId}/plans?new=1`} className="text-accent-fg hover:underline">
                Create a plan
              </Link>
            </>
          ) : (
            "Add an override or add-on above to see how it changes each plan."
          )}
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {header}
      <TableContainer>
        <Table>
          <THead>
            <tr>
              <TH icon={<Layers />} className="min-w-44">
                Plan
              </TH>
              {incentive.entitlements.map((ref) => {
                const ent = entById.get(ref.id);
                return (
                  <TH key={ref.id} icon={ent?.type === "boolean" ? <ToggleRight /> : <Hash />}>
                    {ent?.name ?? ref.id}
                  </TH>
                );
              })}
              {incentive.addons.length ? <TH icon={<Puzzle />}>Add-ons</TH> : null}
            </tr>
          </THead>
          <TBody>
            {plans.map((plan) => {
              const planRefs = new Map(plan.entitlements.map((e) => [e.id, e]));
              const added = incentive.addons.filter((id) => !plan.addons.includes(id));
              return (
                <TR key={plan.id} interactive onClick={() => router.push(`/apps/${appId}/plans/${plan.id}`)}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <RecordIcon size="sm" tone={plan.isFree ? "green" : "blue"}>
                        <Layers />
                      </RecordIcon>
                      <span className="truncate font-medium">{plan.name}</span>
                    </div>
                  </TD>
                  {incentive.entitlements.map((ref) => (
                    <TD key={ref.id}>
                      <ChangeCell
                        planName={plan.name}
                        change={changeFor(planRefs.get(ref.id), ref, entById.get(ref.id)?.type ?? "usage")}
                      />
                    </TD>
                  ))}
                  {incentive.addons.length ? (
                    <TD>
                      {added.length ? (
                        <span className="flex items-center gap-1">
                          {added.slice(0, 2).map((id) => (
                            <Badge key={id} color="green" icon={<Plus />}>
                              {addonName.get(id) ?? id}
                            </Badge>
                          ))}
                          {added.length > 2 ? <span className="text-xs text-fg-tertiary">+{added.length - 2}</span> : null}
                        </span>
                      ) : (
                        <Tooltip
                          content={`Unchanged: ${plan.name} already includes ${incentive.addons.length === 1 ? "it" : "them"}`}
                        >
                          <span className="text-fg-placeholder">—</span>
                        </Tooltip>
                      )}
                    </TD>
                  ) : null}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-bg-subtle px-5 py-2 text-[11px] text-fg-tertiary [&_svg]:size-3">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="text-success-fg" />
          Raised
        </span>
        <span className="inline-flex items-center gap-1">
          <Plus className="text-success-fg" />
          Granted
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingDown className="text-warning-fg" />
          Lowered
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-fg-placeholder">—</span>
          Unchanged
        </span>
      </div>
    </Card>
  );
}
