"use client";

import { Toast } from "@base-ui/react/toast";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { ReactNode } from "react";

const manager = Toast.createToastManager();

type Tone = "success" | "error" | "info";

function add(tone: Tone, title: ReactNode, description?: ReactNode) {
  return manager.add({ title, description, type: tone, timeout: tone === "error" ? 6000 : 3500 });
}

/** Imperative toasts, usable outside React (e.g. in mutation callbacks). */
export const toast = {
  success: (title: ReactNode, description?: ReactNode) => add("success", title, description),
  error: (title: ReactNode, description?: ReactNode) => add("error", title, description),
  info: (title: ReactNode, description?: ReactNode) => add("info", title, description),
};

const icons: Record<Tone, ReactNode> = {
  success: <CircleCheck className="size-4 text-success" />,
  error: <CircleAlert className="size-4 text-danger" />,
  info: <Info className="size-4 text-accent" />,
};

export function Toaster({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={manager} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 right-4 z-[70] w-[calc(100vw-2rem)] sm:w-[340px]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root key={t.id} toast={t} className="toast rounded-lg border border-border bg-bg-elevated shadow-lg">
      <Toast.Content className="toast-content flex items-start gap-2.5 px-3 py-2.5">
        <span className="mt-0.5 flex">{icons[(t.type as Tone) ?? "info"] ?? icons.info}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Toast.Title className="text-sm font-medium text-fg" />
          <Toast.Description className="text-xs text-fg-tertiary" />
        </div>
        <Toast.Close
          aria-label="Dismiss"
          className="-mr-1 flex size-5 items-center justify-center rounded text-fg-tertiary hover:bg-bg-hover hover:text-fg"
        >
          <X className="size-3.5" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}
