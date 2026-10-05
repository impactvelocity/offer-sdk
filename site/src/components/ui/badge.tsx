import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeColor = "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" | "pink" | "teal";

// Pastel tags, as in offer-app/src/components/ui/badge.tsx.
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
};

export function Badge({
  children,
  color = "gray",
  icon,
  className,
}: {
  children: ReactNode;
  color?: BadgeColor;
  icon?: ReactNode;
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
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Square pastel tile for a feature or record icon. */
export function IconTile({ children, color = "gray", className }: { children: ReactNode; color?: BadgeColor; className?: string }) {
  return (
    <span className={cn("inline-flex size-8 items-center justify-center rounded-lg [&_svg]:size-4", colors[color], className)}>
      {children}
    </span>
  );
}

/** Pill above a hero headline: a hairline chip with an optional colored lead-in. */
export function Eyebrow({ children, lead, className }: { children: ReactNode; lead?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full border border-border-strong bg-bg/60 pr-3 pl-1 text-xs text-fg-secondary shadow-xs backdrop-blur",
        !lead && "pl-3",
        className,
      )}
    >
      {lead ? (
        <span className="inline-flex h-5 items-center rounded-full bg-accent-subtle px-2 text-2xs font-medium text-accent-fg">
          {lead}
        </span>
      ) : null}
      {children}
    </span>
  );
}
