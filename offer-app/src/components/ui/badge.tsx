import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeColor = "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" | "pink" | "teal" | "brand";

// Attio-style pastel tags.
const colors: Record<BadgeColor, string> = {
  gray: "bg-tag-gray-bg text-tag-gray-fg",
  blue: "bg-tag-blue-bg text-tag-blue-fg",
  green: "bg-tag-green-bg text-tag-green-fg",
  yellow: "bg-tag-yellow-bg text-tag-yellow-fg",
  orange: "bg-tag-orange-bg text-tag-orange-fg",
  red: "bg-tag-red-bg text-tag-red-fg",
  purple: "bg-tag-purple-bg text-tag-purple-fg",
  pink: "bg-tag-pink-bg text-tag-pink-fg",
  teal: "bg-tag-teal-bg text-tag-teal-fg",
  // Brand highlight (featured, proposed, AI): the accent green.
  brand: "bg-tag-brand-bg text-tag-brand-fg",
};

const dots: Record<BadgeColor, string> = {
  gray: "bg-[#a0a2a8]",
  blue: "bg-tag-blue-fg",
  green: "bg-success",
  yellow: "bg-warning",
  orange: "bg-[#f07a2a]",
  red: "bg-danger",
  purple: "bg-[#8b5cf6]",
  pink: "bg-[#e0479e]",
  teal: "bg-[#14a39d]",
  brand: "bg-accent",
};

export function Badge({
  children,
  color = "gray",
  icon,
  dot,
  className,
}: {
  children: ReactNode;
  color?: BadgeColor;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full shrink-0 items-center gap-1 rounded-[5px] px-2 text-xs font-medium leading-none whitespace-nowrap [&_svg]:size-3.5",
        colors[color],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dots[color])} /> : null}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Status dot + label, as Attio renders select/status attributes. */
export function StatusDot({ color = "gray", children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-fg">
      <span className={cn("size-2 rounded-full", dots[color])} />
      {children}
    </span>
  );
}

/** White chip with a border, used for references to other records (a plan, an incentive). */
export function Chip({ children, icon, className }: { children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border border-border bg-bg px-2 text-sm text-fg shadow-xs [&_svg]:size-3.5 [&_svg]:text-fg-icon",
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Monospace id pill. */
export function IdTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code className={cn("inline-flex h-[22px] items-center rounded-[5px] bg-bg-muted px-1.5 text-[12.5px] text-fg-secondary", className)}>
      {children}
    </code>
  );
}
