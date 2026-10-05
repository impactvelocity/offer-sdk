"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;

export const backdropClass =
  "fixed inset-0 z-50 bg-[var(--backdrop)] transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0";

export function DialogContent({
  children,
  className,
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const width = { sm: "max-w-[420px]", md: "max-w-[520px]", lg: "max-w-[640px]", xl: "max-w-[800px]" }[size];
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className={backdropClass} />
      <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8 pt-[12vh]">
        <BaseDialog.Popup
          className={cn(
            "relative flex w-full flex-col rounded-xl border border-border bg-bg-elevated shadow-lg outline-none transition-[transform,opacity] duration-150 ease-out data-starting-style:translate-y-1 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
            width,
            className,
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

/** Attio-style compact header: small icon + title, close on the right. */
export function DialogHeader({ icon, title, description }: { icon?: ReactNode; title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
      <div className="flex items-center gap-2.5">
        {icon ? <span className="flex text-fg-icon [&_svg]:size-4">{icon}</span> : null}
        <BaseDialog.Title className="text-base font-semibold text-fg">{title}</BaseDialog.Title>
        <BaseDialog.Close
          aria-label="Close"
          className="ml-auto -mr-1 flex size-7 items-center justify-center rounded-md text-fg-icon outline-none hover:bg-bg-hover hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)]"
        >
          <X className="size-4" />
        </BaseDialog.Close>
      </div>
      {description ? (
        <BaseDialog.Description className="text-sm text-fg-tertiary">{description}</BaseDialog.Description>
      ) : null}
    </div>
  );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-5 px-5 py-5", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 rounded-b-xl border-t border-border bg-bg-subtle px-5 py-3", className)}>
      {children}
    </div>
  );
}
