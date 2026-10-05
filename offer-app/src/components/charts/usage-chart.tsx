"use client";

import { useId, useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from "recharts";
import { cn, formatNumber } from "@/lib/utils";
import type { ChartSeries } from "./chart-legend";
import { ChartTooltipCard } from "./chart-tooltip";
import { BrandGradientDefs, svgId } from "./brand-gradient";
import { chart } from "./palette";
import { niceTicks } from "./ticks";
import { formatBucket, formatBucketLong, type Granularity } from "./timeseries";

export type ChartDatum = { date: string } & Record<string, number | string>;

const compactTick = (v: number) => formatNumber(v, { compact: true });
const defaultFormat = (v: number) => formatNumber(v);

function Axes({ ticks }: { ticks: number[] }) {
  return (
    <>
      <CartesianGrid vertical={false} stroke={chart.grid} />
      <XAxis
        dataKey="date"
        tickFormatter={formatBucket}
        tickLine={false}
        axisLine={{ stroke: chart.baseline }}
        tick={chart.tick}
        tickMargin={8}
        minTickGap={28}
        interval="preserveStartEnd"
      />
      <YAxis
        width="auto"
        axisLine={false}
        tickLine={false}
        tick={chart.tick}
        tickMargin={6}
        ticks={ticks}
        domain={[ticks[0], ticks[ticks.length - 1]]}
        interval={0}
        tickFormatter={compactTick}
      />
    </>
  );
}

const GAP = 2;
const RADIUS = 4;

/** Stacked segment: 2px surface gap above it, 4px rounded data-end only on the top of the stack. */
function Segment({ x, y, width, height, fill, rounded }: BarShapeProps & { rounded: boolean }) {
  if (!width || !height) return <g />;
  let top = height < 0 ? y + height : y;
  const bottom = height < 0 ? y : y + height;
  if (!rounded && bottom - top > GAP + 1) top += GAP;
  const h = bottom - top;
  const r = rounded ? Math.min(RADIUS, width / 2, h) : 0;
  const d = r
    ? `M${x},${bottom}V${top + r}A${r},${r} 0 0 1 ${x + r},${top}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${top + r}V${bottom}Z`
    : `M${x},${bottom}V${top}H${x + width}V${bottom}Z`;
  return <path d={d} fill={fill} />;
}

/**
 * Stacked columns over time buckets, one series per entitlement (bottom to top in `series`
 * order). Hidden series are dropped from the stack but keep their colors.
 */
export function UsageBarChart({
  data,
  series,
  hidden,
  granularity,
  valueFormatter = defaultFormat,
  height = 260,
  className,
}: {
  data: ChartDatum[];
  series: ChartSeries[];
  hidden?: ReadonlySet<string>;
  granularity: Granularity;
  valueFormatter?: (value: number) => ReactNode;
  height?: number;
  className?: string;
}) {
  const visible = useMemo(() => series.filter((s) => !hidden?.has(s.key)), [series, hidden]);
  // Topmost non-empty segment per bucket gets the rounded end.
  const tops = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data) {
      const top = visible.findLast((s) => Number(d[s.key]) > 0);
      if (top) map.set(d.date, top.key);
    }
    return map;
  }, [data, visible]);
  const ticks = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const d of data) {
      let pos = 0;
      let neg = 0;
      for (const s of visible) {
        const v = Number(d[s.key] ?? 0);
        if (v > 0) pos += v;
        else neg += v;
      }
      max = Math.max(max, pos);
      min = Math.min(min, neg);
    }
    return niceTicks(min, max);
  }, [data, visible]);

  return (
    <div className={cn("tabular", className)}>
      <BarChart
        data={data}
        responsive
        style={{ width: "100%", height }}
        margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
        barCategoryGap="22%"
        maxBarSize={24}
      >
        <Axes ticks={ticks} />
        <Tooltip
          cursor={{ fill: chart.cursorFill }}
          isAnimationActive={false}
          wrapperStyle={{ outline: "none" }}
          content={(props: TooltipContentProps) => (
            <StackTooltip {...props} series={visible} granularity={granularity} valueFormatter={valueFormatter} />
          )}
        />
        {visible.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="usage"
            fill={s.color}
            isAnimationActive={false}
            shape={(props: BarShapeProps) => <Segment {...props} rounded={tops.get(props.payload?.date) === s.key} />}
          />
        ))}
      </BarChart>
    </div>
  );
}

function StackTooltip({
  active,
  payload,
  label,
  series,
  granularity,
  valueFormatter,
}: TooltipContentProps & {
  series: ChartSeries[];
  granularity: Granularity;
  valueFormatter: (value: number) => ReactNode;
}) {
  const datum = payload?.[0]?.payload as ChartDatum | undefined;
  if (!active || !datum) return null;
  // Mirror the visual stack: top series first.
  const rows = [...series].reverse().map((s) => ({
    key: s.key,
    label: s.label,
    value: valueFormatter(Number(datum[s.key] ?? 0)),
    color: s.color,
  }));
  const total = series.reduce((sum, s) => sum + Number(datum[s.key] ?? 0), 0);
  return (
    <ChartTooltipCard
      title={formatBucketLong(String(label ?? datum.date), granularity)}
      rows={rows}
      footer={series.length > 1 ? { key: "total", label: "Total", value: valueFormatter(total) } : undefined}
    />
  );
}

/**
 * Single-series area with a crosshair: a 2px line over a wash that fades to the baseline.
 * Defaults to the brand gradient; pass `color` for a flat series color. `breakdown` lists
 * extra per-bucket fields shown in the tooltip under the headline value.
 */
export function UsageAreaChart({
  data,
  dataKey,
  label,
  granularity,
  breakdown = [],
  color,
  valueFormatter = defaultFormat,
  height = 200,
  className,
}: {
  data: ChartDatum[];
  dataKey: string;
  label: string;
  granularity: Granularity;
  breakdown?: { key: string; label: string }[];
  color?: string;
  valueFormatter?: (value: number) => ReactNode;
  height?: number;
  className?: string;
}) {
  const ticks = useMemo(() => {
    const values = data.map((d) => Number(d[dataKey] ?? 0));
    return niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  }, [data, dataKey]);
  const id = svgId(useId());
  const stroke = color ?? `url(#${id}-stroke)`;
  // Swatch/dot color for the tooltip and active point (a gradient can't fill those).
  const solid = color ?? "var(--brand-from)";

  return (
    <div className={cn("tabular", className)}>
      <AreaChart data={data} responsive style={{ width: "100%", height }} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <BrandGradientDefs id={id} fillOpacity={0.22} />
        <Axes ticks={ticks} />
        <Tooltip
          cursor={{ stroke: chart.cursorStroke, strokeWidth: 1 }}
          isAnimationActive={false}
          wrapperStyle={{ outline: "none" }}
          content={({ active, payload }: TooltipContentProps) => {
            const datum = payload?.[0]?.payload as ChartDatum | undefined;
            if (!active || !datum) return null;
            const details = breakdown
              .map((b) => ({ key: b.key, label: b.label, value: Number(datum[b.key] ?? 0) }))
              .filter((r) => r.value !== 0)
              .map((r) => ({ ...r, value: valueFormatter(r.value) }));
            return (
              <ChartTooltipCard
                title={formatBucketLong(datum.date, granularity)}
                rows={[{ key: dataKey, label, value: valueFormatter(Number(datum[dataKey] ?? 0)), color: solid }]}
                details={details}
              />
            );
          }}
        />
        <Area
          dataKey={dataKey}
          name={label}
          type="monotone"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={color ?? `url(#${id}-wash)`}
          fillOpacity={color ? 0.1 : 1}
          mask={color ? undefined : `url(#${id}-mask)`}
          dot={false}
          activeDot={{ r: 4, fill: solid, stroke: "var(--bg)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  );
}
