"use client";

import { Drawer } from "@base-ui/react/drawer";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A demo's control panels. From `lg` up they sit in the left column as before; on narrower screens
 * a sticky bar shows what's set (`summary`) and an Edit button opens the same panels in a bottom
 * drawer, so the mock app gets the whole width.
 */
export function ControlsDrawer({
  title,
  summary,
  className,
  children,
}: {
  /** Drawer heading, e.g. "Demo settings". */
  title: string;
  /** One line on the bar: the current plan, customer or visitor. */
  summary: ReactNode;
  /** Extra classes for the desktop column (grid placement). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      <aside className={cn("hidden space-y-4 lg:block", className)}>{children}</aside>

      <Drawer.Root>
        <div className="sticky top-16 z-20 lg:hidden">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-panel/90 py-2 pr-2 pl-4 shadow-lg shadow-black/30 backdrop-blur-md">
            <div className="min-w-0 flex-1">
              <p className="text-2xs text-fg-muted">{title}</p>
              <p className="truncate text-sm text-fg">{summary}</p>
            </div>
            <Drawer.Trigger className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-bg-active px-3 text-sm text-fg ring-1 ring-inset ring-border-strong transition-colors hover:bg-bg-hover [&_svg]:size-4 [&_svg]:text-accent-fg">
              <SlidersHorizontal />
              Edit
            </Drawer.Trigger>
          </div>
        </div>

        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl border-t border-border-strong bg-canvas shadow-2xl shadow-black/60 transition-transform duration-300 ease-out [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:transition-none">
              <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border-strong" aria-hidden />
              <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
                <Drawer.Title className="font-display text-base font-medium text-fg">{title}</Drawer.Title>
                <Drawer.Close className="h-8 rounded-lg px-3 text-sm text-accent-fg transition-colors hover:bg-bg-hover">
                  Done
                </Drawer.Close>
              </div>
              <Drawer.Content className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {children}
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
