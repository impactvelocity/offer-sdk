import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  // Edge sections (tinted footers, headers) follow the card's corners without clipping overflow.
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg shadow-sm [&>:first-child]:rounded-t-[11px] [&>:last-child]:rounded-b-[11px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 border-b border-border bg-bg-subtle px-5 py-4", className)}>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-fg-tertiary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/** Settings-page section: title + description on top, content below, divided by hairlines. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    // Hairline only between consecutive sections (PageTitle already draws its own divider).
    <section
      className={cn(
        "border-t border-border py-8 first:border-t-0 first:pt-0 [:not(section)+&]:border-t-0 [:not(section)+&]:pt-0",
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-fg-tertiary">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 px-5 py-4", className)}>
      <div className="flex items-center gap-1.5 text-sm text-fg-tertiary [&_svg]:size-4 [&_svg]:text-fg-icon">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl font-semibold text-fg">{value}</div>
      {hint ? <div className="text-xs text-fg-tertiary">{hint}</div> : null}
    </div>
  );
}
