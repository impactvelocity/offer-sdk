import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeColor = "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" | "pink" | "teal" | "brand";

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
  brand: "bg-tag-brand-bg text-tag-brand-fg",
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
