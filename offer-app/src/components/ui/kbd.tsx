import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-bg px-1 font-sans text-[11.5px] font-medium leading-none text-fg-icon shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
