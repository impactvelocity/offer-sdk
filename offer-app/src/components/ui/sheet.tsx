"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { backdropClass } from "./dialog";

export const Sheet = BaseDialog.Root;
export const SheetTrigger = BaseDialog.Trigger;
export const SheetClose = BaseDialog.Close;
export const SheetTitle = BaseDialog.Title;
export const SheetDescription = BaseDialog.Description;

/** Right-hand drawer: full height, slides in from the edge. */
export function SheetContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className={backdropClass} />
      <BaseDialog.Popup
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-border bg-bg-elevated shadow-lg outline-none transition-transform duration-200 ease-out data-starting-style:translate-x-full data-ending-style:translate-x-full sm:inset-y-2 sm:right-2 sm:rounded-xl sm:border",
          className,
        )}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

/** Floating close button for sheets whose top edge is a hero rather than a header bar. */
export function SheetCloseButton({ className }: { className?: string }) {
  return (
    <BaseDialog.Close
      aria-label="Close"
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-fg-icon outline-none hover:bg-bg-hover hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)]",
        className,
      )}
    >
      <X className="size-4" />
    </BaseDialog.Close>
  );
}
