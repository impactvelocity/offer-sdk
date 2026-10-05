"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { backdropClass } from "./dialog";
import { Input } from "./input";

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** Require typing this exact text before confirming (for irreversible actions). */
  typeToConfirm?: string;
  /** Runs before the dialog closes; the dialog shows a spinner until it settles. Throw to keep it open. */
  onConfirm?: () => Promise<unknown> | unknown;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** `const confirm = useConfirm(); if (await confirm({ title: "Delete plan?" })) …` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const resolver = useRef<(value: boolean) => void>(undefined);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setTyped("");
    setBusy(false);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOpen(false);
  };

  const onConfirm = async () => {
    if (!options) return;
    if (options.onConfirm) {
      setBusy(true);
      try {
        await options.onConfirm();
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    close(true);
  };

  const blocked = Boolean(options?.typeToConfirm && typed.trim() !== options.typeToConfirm);
  const danger = (options?.tone ?? "danger") === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={(next) => !next && !busy && close(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className={backdropClass} />
          <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh]">
            <AlertDialog.Popup
              className={cn(
                "w-full max-w-[460px] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg outline-none transition-[transform,opacity] duration-150 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              )}
            >
              <AlertDialog.Title className="text-lg font-semibold text-fg">{options?.title}</AlertDialog.Title>
              {options?.description ? (
                <AlertDialog.Description className="mt-2 text-sm text-fg-secondary">{options.description}</AlertDialog.Description>
              ) : null}
              {options?.typeToConfirm ? (
                <div className="mt-4 flex flex-col gap-1.5">
                  <label className="text-sm text-fg-secondary">
                    Type <span className="font-semibold text-fg">{options.typeToConfirm}</span> to confirm
                  </label>
                  <Input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !blocked && onConfirm()}
                  />
                </div>
              ) : null}
              <div className="mt-6 flex justify-end gap-2">
                <AlertDialog.Close render={<Button disabled={busy} />}>{options?.cancelLabel ?? "Cancel"}</AlertDialog.Close>
                <Button
                  variant={danger ? "danger" : "primary"}
                  disabled={blocked}
                  loading={busy}
                  onClick={onConfirm}
                  autoFocus={!options?.typeToConfirm}
                >
                  {options?.confirmLabel ?? (danger ? "Delete" : "Confirm")}
                </Button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}
