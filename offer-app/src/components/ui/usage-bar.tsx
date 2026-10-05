import { cn } from "@/lib/utils";

export function usageTone(usage: number, max: number | null) {
  if (max === null || max === 0) return max === 0 && usage > 0 ? "danger" : "normal";
  const ratio = usage / max;
  return ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "normal";
}

/** Thin usage meter. Unlimited limits render as a hatched track. */
export function UsageBar({ usage, max, className }: { usage: number; max: number | null; className?: string }) {
  const tone = usageTone(usage, max);
  const pct = max === null ? 100 : max === 0 ? 100 : Math.min(100, (usage / max) * 100);
  return (
    <div
      role="meter"
      aria-valuenow={usage}
      aria-valuemin={0}
      aria-valuemax={max ?? undefined}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-bg-active", className)}
    >
      {max === null ? (
        <div className="h-full w-full bg-[repeating-linear-gradient(-45deg,var(--border-strong)_0_3px,transparent_3px_6px)]" />
      ) : (
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-accent",
          )}
          style={{ width: `${Math.max(pct, usage > 0 ? 2 : 0)}%` }}
        />
      )}
    </div>
  );
}
