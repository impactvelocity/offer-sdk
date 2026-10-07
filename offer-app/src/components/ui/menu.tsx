"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { popupItem, popupSurface } from "./popup";

export const Menu = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;
export const MenuGroup = BaseMenu.Group;

export function MenuContent({
  children,
  className,
  align = "start",
  side = "bottom",
  sideOffset = 4,
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
}) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner className="z-50 outline-none" align={align} side={side} sideOffset={sideOffset}>
        <BaseMenu.Popup className={cn(popupSurface, "min-w-48", className)}>{children}</BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

export function MenuItem({
  className,
  tone,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.Item> & { tone?: "danger"; shortcut?: ReactNode; className?: string }) {
  return (
    <BaseMenu.Item
      className={cn(popupItem, tone === "danger" && "text-danger-fg [&_svg]:!text-danger-fg data-highlighted:bg-danger-subtle", className)}
      {...props}
    >
      {children}
      {shortcut ? <span className="ml-auto pl-4 text-xs text-fg-tertiary">{shortcut}</span> : null}
    </BaseMenu.Item>
  );
}

export function MenuLinkItem({ className, ...props }: ComponentProps<typeof BaseMenu.LinkItem> & { className?: string }) {
  return <BaseMenu.LinkItem className={cn(popupItem, className)} {...props} />;
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.CheckboxItem> & { className?: string }) {
  return (
    <BaseMenu.CheckboxItem className={cn(popupItem, "pr-8 relative", className)} {...props}>
      {children}
      <BaseMenu.CheckboxItemIndicator className="absolute right-2 flex">
        <Check className="!text-accent-fg" />
      </BaseMenu.CheckboxItemIndicator>
    </BaseMenu.CheckboxItem>
  );
}

export function MenuSeparator() {
  return <BaseMenu.Separator className="-mx-1.5 my-1.5 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <BaseMenu.GroupLabel className="px-2.5 pb-1 pt-2 text-xs font-medium text-fg-tertiary">{children}</BaseMenu.GroupLabel>;
}
