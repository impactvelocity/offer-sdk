"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = BaseTooltip.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  shortcut,
  className,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  shortcut?: ReactNode;
  className?: string;
}) {
  if (!content) return children;
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className="z-[60]">
          <BaseTooltip.Popup
            className={cn(
              "flex origin-[var(--transform-origin)] items-center gap-2 rounded-md bg-bg-inverse px-2 py-1 text-xs font-medium text-fg-inverse shadow-md transition-[transform,scale,opacity] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:opacity-0 data-instant:duration-0",
              className,
            )}
          >
            {content}
            {shortcut ? <span className="opacity-60">{shortcut}</span> : null}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
