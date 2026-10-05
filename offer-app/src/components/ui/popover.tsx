"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { popupSurface } from "./popup";

export const Popover = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverClose = BasePopover.Close;

export function PopoverContent({
  children,
  className,
  align = "start",
  side = "bottom",
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner className="z-50" align={align} side={side} sideOffset={6}>
        <BasePopover.Popup className={cn(popupSurface, "p-3", className)}>{children}</BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
