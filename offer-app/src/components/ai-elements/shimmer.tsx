import type { ElementType } from "react";
import { cn } from "@/lib/utils";

// Adapted from AI Elements (registry.ai-sdk.dev/shimmer) as a CSS-only effect, so it doesn't
// pull in motion. The sweep is the `animate-shimmer` keyframes in globals.css.

export function Shimmer({
  children,
  as: Component = "span",
  className,
}: {
  children: string;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Component
      className={cn(
        "inline-block animate-shimmer bg-clip-text text-transparent [background-size:250%_100%]",
        "bg-[linear-gradient(90deg,var(--fg-tertiary)_0%,var(--fg-tertiary)_40%,var(--fg-placeholder)_50%,var(--fg-tertiary)_60%,var(--fg-tertiary)_100%)]",
        className,
      )}
    >
      {children}
    </Component>
  );
}
