"use client";

import { Activity, ChartColumn, Sigma } from "lucide-react";
import { useState } from "react";
import { BarList } from "@/components/analytics/bar-list";
import { intervalLabel, PeriodPicker } from "@/components/analytics/period-picker";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsSummary } from "@/lib/api/hooks";
import type { AnalyticsInterval } from "@/lib/api/types";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { Callout } from "@/components/ui/callout";

export function AnalyticsTab({
  appId,
  accountId,
  entitlementNames,
}: {
  appId: string;
  accountId: string;
  entitlementNames: Map<string, string>;
}) {
  const [period, setPeriod] = useState<AnalyticsInterval>("30d");
  const { data, isLoading, isFetching, isPlaceholderData, error } = useAnalyticsSummary(appId, period, accountId);
  const rows = data ?? [];
  const totalUsage = rows.reduce((sum, r) => sum + r.total_amount, 0);
  const calls = rows.reduce((sum, r) => sum + r.calls, 0);

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{intervalLabel(period)}</h2>
        <PeriodPicker value={period} onValueChange={setPeriod} />
      </div>
      {error && !data ? (
        <Callout tone="danger">Couldn&apos;t load analytics: {error.message}</Callout>
      ) : isLoading ? (
        <>
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </>
      ) : !rows.length ? (
        <Card>
          <EmptyState
            compact
            icon={<ChartColumn />}
            title="No usage in this period"
            description="Nothing was tracked for this account. Pick a longer period, or send a call with the usage simulator."
          />
        </Card>
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", isFetching && isPlaceholderData && "opacity-60")}>
          <Card className="grid grid-cols-2 divide-x divide-border">
            <Stat icon={<Sigma />} label="Total usage" value={formatNumber(totalUsage)} hint="Sum of tracked amounts" />
            <Stat
              icon={<Activity />}
              label="Tracking calls"
              value={formatNumber(calls)}
              hint="add, remove and amount calls"
            />
          </Card>
          <Card>
            <CardHeader title="Usage by Entitlement" />
            <div className="p-2">
              <BarList
                items={rows.map((r) => ({
                  key: r.entitlement_id,
                  label: entitlementNames.get(r.entitlement_id) ?? r.entitlement_id,
                  value: r.total_amount,
                  secondary: pluralize(r.calls, "call"),
                }))}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
