import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Attio's record page: a header strip, then a main column (tabs) and a right-hand
 * "Details" panel.
 */
export function RecordLayout({ main, panel }: { main: ReactNode; panel: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
        {main}
        {/* Below lg the details panel stacks under the main content instead of disappearing. */}
        <aside className="mt-auto border-t border-border lg:hidden">{panel}</aside>
      </div>
      <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border scrollbar-thin lg:block">{panel}</aside>
    </div>
  );
}

export function RecordHeader({
  icon,
  title,
  badges,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-8 pb-6 pt-7">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate font-display text-2xl font-semibold text-fg">{title}</h1>
          {badges}
        </div>
        {subtitle ? <div className="mt-1 text-sm text-fg-tertiary">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Square tinted icon used for catalog records (plans, incentives…). */
export function RecordIcon({
  children,
  tone = "gray",
  size = "lg",
}: {
  children: ReactNode;
  tone?: "gray" | "blue" | "green" | "purple" | "orange" | "pink";
  size?: "sm" | "lg";
}) {
  const tones = {
    gray: "bg-bg-muted text-fg-secondary",
    blue: "bg-tag-blue-bg text-tag-blue-fg",
    green: "bg-tag-green-bg text-tag-green-fg",
    purple: "bg-tag-purple-bg text-tag-purple-fg",
    orange: "bg-tag-orange-bg text-tag-orange-fg",
    pink: "bg-tag-pink-bg text-tag-pink-fg",
  };
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "lg" ? "size-12 rounded-xl [&_svg]:size-6" : "size-6 rounded-md [&_svg]:size-3.5",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PanelSection({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border px-5 py-5", className)}>
      <div className="mb-2 flex h-7 items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}
