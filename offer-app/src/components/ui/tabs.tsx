"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Tabs = BaseTabs.Root;

/** Attio-style underline tabs that sit on a full-width hairline. */
export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BaseTabs.List className={cn("relative flex items-center gap-1 overflow-x-auto border-b border-border px-6 [scrollbar-width:none]", className)}>
      {children}
      <BaseTabs.Indicator renderBeforeHydration className="absolute bottom-[-1px] left-[var(--active-tab-left)] h-[2px] w-[var(--active-tab-width)] rounded-full bg-fg transition-[left,width] duration-200 ease-out" />
    </BaseTabs.List>
  );
}

export function Tab({
  icon,
  count,
  children,
  className,
  ...props
}: ComponentProps<typeof BaseTabs.Tab> & { icon?: ReactNode; count?: number | null; className?: string }) {
  return (
    <BaseTabs.Tab
      className={cn(
        "group my-1.5 flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-sm font-medium text-fg-tertiary outline-none transition-colors hover:bg-bg-hover hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] data-active:text-fg [&_svg]:size-4 [&_svg]:text-fg-icon data-active:[&_svg]:text-fg",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && count !== null ? (
        <span className="rounded-[4px] bg-bg-muted px-1.5 text-xs tabular text-fg-tertiary group-data-active:bg-bg-active group-data-active:text-fg-secondary">
          {count}
        </span>
      ) : null}
    </BaseTabs.Tab>
  );
}

export function TabsPanel({ className, ...props }: ComponentProps<typeof BaseTabs.Panel> & { className?: string }) {
  return <BaseTabs.Panel className={cn("outline-none", className)} {...props} />;
}
