"use client";

import { Check, Gift, KeyRound, Layers, Puzzle, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatLimit } from "@/components/catalog/format";
import { Badge, StatusDot, type BadgeColor } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { UsageBar } from "@/components/ui/usage-bar";
import type { Addon, Entitlement, Incentive, Plan, ResolvedEntitlement, ResolvedPlan } from "@/lib/api/types";
import { cn, formatNumber } from "@/lib/utils";
import { Callout } from "@/components/ui/callout";
import { addonSources, resolveLimits, type AccessSource } from "./resolve";

/** "What can this customer do right now, and why?" */
export function AccessTab({
  appId,
  planId,
  resolved,
  loading,
  error,
  planMissing,
  plan,
  incentive,
  entitlements,
  addons,
  onChangePlan,
}: {
  appId: string;
  planId: string;
  resolved: ResolvedPlan | undefined;
  loading: boolean;
  error: Error | null;
  planMissing: boolean;
  plan: Plan | undefined;
  incentive: Incentive | undefined;
  entitlements: Entitlement[];
  addons: Addon[];
  onChangePlan: () => void;
}) {
  if (planMissing) {
    return (
      <Callout tone="warning" action={<Button onClick={onChangePlan}>Change Plan</Button>}>
        This account is on <code className="font-medium">{planId}</code>, which no longer exists, so your app&apos;s access
        checks for it fail with “Plan not found”. Move it to another plan to restore access.
      </Callout>
    );
  }
  if (error && !resolved)
    return <Callout tone="danger">Couldn&apos;t resolve this account&apos;s access: {error.message}</Callout>;
  if (loading || !resolved) {
    return (
      <>
        <Skeleton className="h-44" />
        <Skeleton className="h-32" />
      </>
    );
  }

  const limits = resolveLimits(plan, incentive);
  const sourceOf = (id: string): AccessSource => limits.get(id)?.source ?? "plan";
  const usage = resolved.entitlements.filter((e) => e.type === "usage");
  const granted = new Map(resolved.entitlements.map((e) => [e.id, e]));
  const features = entitlements.filter((e) => e.type === "boolean");
  const addonName = new Map(addons.map((a) => [a.id, a.name]));
  const addonFrom = addonSources(plan, incentive);
  const planName = plan?.name ?? planId;

  const sourceBadge = (id: string) => {
    const limit = limits.get(id);
    if (limit?.source === "override") {
      return (
        <Tooltip content={`Plan limit ${formatLimit(limit.planMax)} → ${formatLimit(limit.max)} from ${incentive?.name}`}>
          <span className="inline-flex">
            <Badge color="orange" icon={<Gift />}>
              Incentive override
            </Badge>
          </span>
        </Tooltip>
      );
    }
    if (limit?.source === "incentive") {
      return (
        <Tooltip content={`Granted by ${incentive?.name}; not part of ${planName}`}>
          <span className="inline-flex">
            <Badge color="orange" icon={<Gift />}>
              Incentive
            </Badge>
          </span>
        </Tooltip>
      );
    }
    return (
      <Badge color="gray" icon={<Layers />}>
        Plan
      </Badge>
    );
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader title="Usage" />
        {usage.length ? (
          <TableContainer>
            <Table className="[&_tbody_tr:last-child>td]:border-b-0">
              <THead>
                <tr>
                  <TH icon={<KeyRound />}>Entitlement</TH>
                  <TH>Usage</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {usage.map((e) => {
                  const status = usageStatus(e);
                  const over = e.max !== null && e.usage > e.max ? e.usage - e.max : 0;
                  return (
                    <TR key={e.id}>
                      <TD>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="font-medium">{e.name}</span>
                          {sourceBadge(e.id)}
                        </div>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-3">
                          <UsageBar usage={e.usage} max={e.max} className="w-20 shrink-0" />
                          <span className="whitespace-nowrap tabular">
                            {formatNumber(e.usage)} <span className="text-fg-tertiary">/ {formatLimit(e.max)}</span>
                          </span>
                          <span className="whitespace-nowrap text-xs tabular text-fg-tertiary">
                            {e.max === null ? null : over ? (
                              <span className="text-danger-fg">over by {formatNumber(over)}</span>
                            ) : (
                              `${formatNumber(e.left ?? Math.max(0, e.max - e.usage))} left`
                            )}
                          </span>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">
                        <StatusDot color={status.color}>{status.label}</StatusDot>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        ) : (
          <CardEmpty>
            {planName} has no usage limits.{" "}
            <Link href={`/apps/${appId}/plans/${encodeURIComponent(planId)}`} className="text-accent-fg hover:underline">
              Add one to the plan
            </Link>
          </CardEmpty>
        )}
      </Card>

      <Card>
        <CardHeader title="Features" />
        {features.length ? (
          <ul className="divide-y divide-border">
            {features.map((f) => {
              const on = granted.get(f.id)?.can ?? false;
              const source = sourceOf(f.id);
              return (
                <li key={f.id} className="flex min-h-12 items-center gap-3 px-5 py-2.5">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3",
                      on ? "bg-success-subtle text-success-fg" : "bg-bg-muted text-fg-placeholder",
                    )}
                  >
                    {on ? <Check strokeWidth={2.5} /> : <X strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", on ? "text-fg" : "text-fg-secondary")}>{f.name}</div>
                    {f.description ? <div className="truncate text-xs text-fg-tertiary">{f.description}</div> : null}
                  </div>
                  <span className="hidden shrink-0 text-xs text-fg-tertiary sm:inline">
                    {on
                      ? source === "plan"
                        ? `From ${planName}`
                        : `From ${incentive?.name ?? "incentive"}`
                      : `Not in ${planName}${incentive ? ` or ${incentive.name}` : ""}`}
                  </span>
                  <Badge color={on ? "green" : "gray"} className="min-w-[104px] justify-center">
                    {on ? "Included" : "Not included"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <CardEmpty>
            No feature flags in this app yet.{" "}
            <Link href={`/apps/${appId}/entitlements?new=1`} className="text-accent-fg hover:underline">
              Create one
            </Link>
          </CardEmpty>
        )}
      </Card>

      <Card>
        <CardHeader title="Add-ons" />
        {resolved.addons.length ? (
          <ul className="divide-y divide-border">
            {resolved.addons.map((id) => (
              <li key={id} className="flex h-12 items-center gap-3 px-5">
                <Puzzle className="size-3.5 shrink-0 text-fg-tertiary" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {addonName.get(id) ?? <code className="text-xs">{id}</code>}
                </span>
                {addonFrom.get(id) === "incentive" ? (
                  <Badge color="orange" icon={<Gift />}>
                    {incentive?.name ?? "Incentive"}
                  </Badge>
                ) : (
                  <Badge color="gray" icon={<Layers />}>
                    {planName}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <CardEmpty>
            No add-ons on {planName}
            {incentive ? ` or ${incentive.name}` : ""}.
          </CardEmpty>
        )}
      </Card>
    </>
  );
}

function usageStatus(e: ResolvedEntitlement): { color: BadgeColor; label: string } {
  if (e.max !== null && e.usage > e.max) return { color: "red", label: "Over limit" };
  if (!e.can) return { color: "red", label: "Limit reached" };
  if (e.max !== null && e.max > 0 && e.usage / e.max >= 0.8) return { color: "yellow", label: "Near limit" };
  return { color: "green", label: "Within limit" };
}

function CardEmpty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-5 text-sm text-fg-tertiary">{children}</p>;
}
