"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Menu as MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { backdropClass } from "@/components/ui/dialog";

const MobileNavContext = createContext<{ setOpen: (open: boolean) => void } | null>(null);

/**
 * Dub-style three columns: icon rail, nav panel, and the page on a white card.
 * Below md, the rail and panel collapse into a drawer opened from the page header.
 */
export function ShellLayout({ rail, panel, children }: { rail: ReactNode; panel: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <MobileNavContext.Provider value={{ setOpen }}>
      <div className="flex h-full bg-canvas">
        <div className="hidden h-full md:flex">{rail}</div>
        <div className="flex min-w-0 flex-1 md:gap-2 md:py-2 md:pr-2">
          <div className="hidden h-full md:flex">{panel}</div>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg md:rounded-xl md:shadow-soft md:ring-1 md:ring-border/70">
            {children}
          </main>
        </div>
      </div>
      <BaseDialog.Root open={open} onOpenChange={setOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className={backdropClass} />
          <BaseDialog.Popup className="fixed inset-y-0 left-0 z-50 flex bg-canvas py-2 pr-2 shadow-lg outline-none transition-transform duration-200 ease-out data-starting-style:-translate-x-full data-ending-style:-translate-x-full md:hidden">
            <BaseDialog.Title className="sr-only">Navigation</BaseDialog.Title>
            {rail}
            {panel}
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </MobileNavContext.Provider>
  );
}

export function MobileNavButton() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      aria-label="Open navigation"
      onClick={() => ctx.setOpen(true)}
      className="-ml-2 flex size-8 shrink-0 items-center justify-center rounded-md text-fg-icon outline-none hover:bg-bg-hover hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] md:hidden"
    >
      <MenuIcon className="size-4" />
    </button>
  );
}
