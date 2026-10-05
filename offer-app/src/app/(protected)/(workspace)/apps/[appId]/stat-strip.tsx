import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { Card, Stat } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StripStat {
  label: string;
  icon: ReactNode;
  /** `undefined` renders a skeleton. */
  value: ReactNode | undefined;
  hint?: ReactNode;
  /** Per-bucket values drawn as a brand-gradient sparkline beside the value. */
  trend?: number[];
}

/** One card of four stats divided by hairlines (two per row on narrow screens). */
export function StatStrip({ stats, className }: { stats: StripStat[]; className?: string }) {
  return (
    <Card className={cn("grid grid-cols-2 lg:grid-cols-4", className)}>
      {stats.map((s, i) => (
        <Stat
          key={s.label}
          icon={s.icon}
          label={
            <span className="min-w-0 truncate" title={s.label}>
              {s.label}
            </span>
          }
          value={
            s.value === undefined ? (
              <Skeleton className="my-1 h-6 w-16" />
            ) : s.trend && s.trend.length > 1 ? (
              <span className="flex items-end justify-between gap-3">
                <span className="min-w-0 truncate">{s.value}</span>
                <Sparkline values={s.trend} className="mb-1 h-7 w-20 shrink-0 xl:w-28" />
              </span>
            ) : (
              s.value
            )
          }
          // Keep every tile the same height while hints load.
          hint={s.hint ?? <span className="invisible">–</span>}
          className={cn(
            "min-w-0 border-border",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        />
      ))}
    </Card>
  );
}
