import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartTooltipRow {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** Series color, drawn as a short line key. Omit for rows that aren't plotted series. */
  color?: string;
}

/**
 * Attio-style chart popup: white, hairline border, soft shadow, 12px text. Values lead, labels
 * follow. `details` are secondary rows (e.g. a breakdown) under a hairline; `footer` is a total.
 */
export function ChartTooltipCard({
  title,
  rows,
  details,
  footer,
  className,
}: {
  title: ReactNode;
  rows: ChartTooltipRow[];
  details?: ChartTooltipRow[];
  footer?: ChartTooltipRow;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none min-w-44 max-w-72 rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 text-xs shadow-md",
        className,
      )}
    >
      <div className="mb-1.5 font-medium text-fg-secondary">{title}</div>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <Row key={row.key} row={row} />
        ))}
      </ul>
      {details?.length ? (
        <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-border pt-1.5">
          {details.map((row) => (
            <Row key={row.key} row={row} muted />
          ))}
        </ul>
      ) : null}
      {footer ? (
        <ul className="mt-1.5 border-t border-border pt-1.5">
          <Row row={footer} strong />
        </ul>
      ) : null}
    </div>
  );
}

function Row({ row, strong, muted }: { row: ChartTooltipRow; strong?: boolean; muted?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {row.color ? <span className="h-0.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} /> : null}
      <span className={cn("min-w-0 flex-1 truncate", strong ? "text-fg" : muted ? "text-fg-tertiary" : "text-fg-secondary")}>
        {row.label}
      </span>
      <span
        className={cn(
          "shrink-0 tabular",
          strong ? "font-semibold text-fg" : muted ? "text-fg-secondary" : "font-medium text-fg",
        )}
      >
        {row.value}
      </span>
    </li>
  );
}
