"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ChartSeries } from "@/components/charts/chart-legend";
import { OTHER_COLOR, OTHER_KEY, SERIES_COLORS } from "@/components/charts/palette";
import { bucketRange, granularityOf } from "@/components/charts/timeseries";
import type { ChartDatum } from "@/components/charts/usage-chart";
import { api } from "@/lib/api/client";
import { keys, useAnalyticsSummary, useEntitlements } from "@/lib/api/hooks";
import type { AnalyticsInterval, TopAccountUsage, UsageTimeseriesPoint } from "@/lib/api/types";

// Usage helpers shared by the Overview and Analytics screens.

export type UsageMetric = "total_amount" | "calls";

/**
 * A stable color per entitlement for this app: slots follow all-time usage rank (then catalog
 * order), so a color never changes with the period or filter. Entitlements past the 8th slot
 * have no color and fold into "Other". Null while loading.
 */
export function useEntitlementColors(appId: string) {
  const entitlements = useEntitlements(appId);
  const alltime = useAnalyticsSummary(appId, "alltime");
  const ready = entitlements.data !== undefined && (alltime.data !== undefined || alltime.isError);
  return useMemo(() => {
    if (!ready) return null;
    const catalog = entitlements.data?.map((e) => e.id) ?? [];
    const order = new Map(catalog.map((id, i) => [id, i]));
    const ranked = [...(alltime.data ?? [])]
      .sort(
        (a, b) =>
          b.total_amount - a.total_amount ||
          (order.get(a.entitlement_id) ?? Infinity) - (order.get(b.entitlement_id) ?? Infinity),
      )
      .map((r) => r.entitlement_id);
    const ids = [...new Set([...ranked, ...catalog])];
    return new Map<string, string>(ids.slice(0, SERIES_COLORS.length).map((id, i) => [id, SERIES_COLORS[i]]));
  }, [ready, entitlements.data, alltime.data]);
}

/** Account names for a set of ids, one cached request per account (shared with useAccount). */
export function useAccountNames(appId: string, ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: keys.account(appId, id),
      queryFn: () => api.accounts.get(appId, id),
      retry: false,
      staleTime: 60_000,
    })),
    combine: (results) => {
      const names = new Map<string, string>();
      const pending = new Set<string>();
      ids.forEach((id, i) => {
        const name = results[i]?.data?.name;
        if (name) names.set(id, name);
        else if (results[i]?.isPending) pending.add(id);
      });
      return { names, pending };
    },
  });
}

/**
 * Turns timeseries rows into chart data: every bucket in the period (gaps filled with 0), the
 * top `maxSeries` entitlements by the metric, and the rest folded into "Other". Series are
 * ordered largest first (bottom of the stack). Each datum also carries `__total`.
 */
export function buildUsageChart(
  points: UsageTimeseriesPoint[],
  {
    interval,
    metric,
    colors,
    names,
    maxSeries,
  }: {
    interval: AnalyticsInterval;
    metric: UsageMetric;
    /** From useEntitlementColors. Without it, slots follow this period's ranking. */
    colors?: Map<string, string>;
    names: Map<string, string>;
    maxSeries: number;
  },
) {
  const dates = bucketRange(interval, points.map((r) => r.date));
  const inRange = new Set(dates);
  const rows = points.filter((r) => inRange.has(r.date));
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.entitlement_id, (totals.get(r.entitlement_id) ?? 0) + r[metric]);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const shown = ranked.filter(([id]) => !colors || colors.has(id)).slice(0, maxSeries);
  const shownIds = new Set(shown.map(([id]) => id));
  const otherTotal = ranked.filter(([id]) => !shownIds.has(id)).reduce((sum, [, v]) => sum + v, 0);

  const series: ChartSeries[] = shown.map(([id, total], i) => ({
    key: id,
    label: names.get(id) ?? id,
    color: colors?.get(id) ?? SERIES_COLORS[i],
    total,
  }));
  const hasOther = ranked.length > shown.length;
  if (hasOther) series.push({ key: OTHER_KEY, label: "Other", color: OTHER_COLOR, total: otherTotal });

  const empty = () => Object.fromEntries([...series.map((s) => [s.key, 0]), ["__total", 0]]);
  const byDate = new Map<string, ChartDatum>(dates.map((date) => [date, { date, ...empty() }]));
  for (const r of rows) {
    const datum = byDate.get(r.date)!;
    const key = shownIds.has(r.entitlement_id) ? r.entitlement_id : OTHER_KEY;
    datum[key] = Number(datum[key] ?? 0) + r[metric];
    datum.__total = Number(datum.__total) + r[metric];
  }
  return { data: [...byDate.values()], series, granularity: granularityOf(interval) };
}

/** Per-bucket totals for one metric (gaps filled), for sparklines. */
export function usageTrend(points: UsageTimeseriesPoint[], interval: AnalyticsInterval, metric: UsageMetric) {
  return buildUsageChart(points, { interval, metric, names: new Map(), maxSeries: 0 }).data.map((d) => Number(d.__total));
}

/** Which metric the top-accounts endpoint ranked by (the mock ranks by calls; Tinybird may differ). */
export function rankedBy(rows: TopAccountUsage[]): UsageMetric {
  return rows.every((r, i) => i === 0 || rows[i - 1].calls >= r.calls) ? "calls" : "total_amount";
}
