import Link from "next/link";
import type { ReactNode } from "react";
import { cn, formatNumber } from "@/lib/utils";

export interface BarListItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Shown muted after the value, e.g. "42 calls". */
  secondary?: ReactNode;
  href?: string;
  icon?: ReactNode;
}

/** Horizontal bars behind each row label: a compact, table-like chart. */
export function BarList({ items, className, valueFormatter = (v: number) => formatNumber(v) }: {
  items: BarListItem[];
  className?: string;
  valueFormatter?: (v: number) => ReactNode;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => {
        const row = (
          <>
            <span
              className="absolute inset-y-0 left-0 rounded-md bg-brand-soft transition-[width] duration-300"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
            <span className="relative flex min-w-0 flex-1 items-center gap-2 [&_svg]:size-3.5 [&_svg]:text-fg-tertiary">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </span>
            <span className="relative shrink-0 tabular text-fg">
              {valueFormatter(item.value)}
              {item.secondary ? <span className="ml-1.5 text-fg-tertiary">{item.secondary}</span> : null}
            </span>
          </>
        );
        const cls = "relative flex h-8 items-center gap-3 rounded-md px-2.5 text-sm";
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className={cn(cls, "outline-none hover:bg-bg-subtle focus-visible:shadow-[0_0_0_2px_var(--ring)]")}>
                {row}
              </Link>
            ) : (
              <div className={cls}>{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
