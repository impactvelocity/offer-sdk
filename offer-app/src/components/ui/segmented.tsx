"use client";

import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Segmented<V extends string>({
  value,
  onValueChange,
  options,
  className,
  size = "sm",
}: {
  value: V;
  onValueChange: (value: V) => void;
  options: { value: V; label: ReactNode; disabled?: boolean }[];
  className?: string;
  size?: "xs" | "sm";
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => next[0] && onValueChange(next[0] as V)}
      className={cn("inline-flex items-center gap-0.5 rounded-md bg-bg-muted p-0.5", className)}
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] px-2 font-medium text-fg-tertiary outline-none transition-colors hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] data-pressed:bg-bg data-pressed:text-fg data-pressed:shadow-sm dark:data-pressed:bg-bg-active data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:size-3.5",
            size === "xs" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
          )}
        >
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
