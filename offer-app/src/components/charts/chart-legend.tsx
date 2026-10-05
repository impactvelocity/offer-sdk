"use client";

import type { ReactNode } from "react";
import { cn, formatNumber } from "@/lib/utils";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** Period total, shown next to the label. */
  total?: number;
}

/**
 * Legend that mirrors the marks (rect swatches for bars/areas). Pass `onToggle` to let
 * readers hide and show series; colors never change when series are hidden.
 */
export function ChartLegend({
  series,
  hidden,
  onToggle,
  valueFormatter = (v) => formatNumber(v, { compact: true }),
  className,
}: {
  series: ChartSeries[];
  hidden?: ReadonlySet<string>;
  onToggle?: (key: string) => void;
  valueFormatter?: (value: number) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1 gap-y-0.5", className)}>
      {series.map((s) => {
        const off = hidden?.has(s.key) ?? false;
        const content = (
          <>
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={off ? { boxShadow: `inset 0 0 0 1.5px ${s.color}` } : { background: s.color }}
            />
            <span className={cn("truncate", off ? "text-fg-placeholder" : "text-fg-secondary")}>{s.label}</span>
            {s.total !== undefined ? (
              <span className={cn("tabular", off ? "text-fg-placeholder" : "text-fg-tertiary")}>{valueFormatter(s.total)}</span>
            ) : null}
          </>
        );
        const cls = "inline-flex h-6 max-w-56 items-center gap-1.5 rounded-md px-1.5 text-xs";
        return onToggle ? (
          <button
            key={s.key}
            type="button"
            aria-pressed={!off}
            title={off ? `Show ${s.label}` : `Hide ${s.label}`}
            onClick={() => onToggle(s.key)}
            className={cn(cls, "focus-ring transition-colors hover:bg-bg-hover")}
          >
            {content}
          </button>
        ) : (
          <span key={s.key} className={cls}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
