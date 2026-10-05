"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The second column of the Dub-style shell: a light panel with the current context's
// title and navigation.

export function NavPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside className={cn("flex h-full w-[252px] shrink-0 flex-col rounded-xl bg-bg shadow-soft ring-1 ring-border/70", className)}>
      {children}
    </aside>
  );
}

export function NavPanelHeader({ title }: { title: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center px-[18px] pb-3 pt-[18px]">
      <h2 className="truncate font-display text-[17px] font-semibold leading-6 text-fg">{title}</h2>
    </div>
  );
}

export function NavPanelBody({ children }: { children: ReactNode }) {
  return <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 pt-1 scrollbar-thin">{children}</nav>;
}

export function NavPanelFooter({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-0.5 px-3 pb-3">{children}</div>;
}

const itemClass =
  "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium tracking-wide text-fg-secondary outline-none transition-colors hover:bg-bg-hover hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-fg-icon";

export function NavItem({
  href,
  icon,
  children,
  active,
  count,
  onClick,
  trailing,
}: {
  href?: string;
  icon?: ReactNode;
  children: ReactNode;
  active?: boolean;
  count?: number | null;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {trailing}
      {count !== undefined && count !== null && count > 0 ? (
        <span className={cn("text-xs tabular", active ? "text-accent-fg/70" : "text-fg-tertiary")}>
          {count > 999 ? "999+" : count}
        </span>
      ) : null}
    </>
  );
  const className = cn(
    itemClass,
    active && "bg-accent-subtle text-accent-fg hover:bg-accent-subtle hover:text-accent-fg [&>svg]:text-accent",
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

/** A labelled group of nav items (Dub-style plain label, not collapsible). */
/** A run of nav items set off by a hairline; the label is for screen readers only. */
export function NavGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-0.5 border-t border-border/70 pt-3">
      {children}
    </div>
  );
}
