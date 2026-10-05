"use client";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof BaseCheckbox.Root> & { className?: string }) {
  return (
    <BaseCheckbox.Root
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong bg-bg shadow-xs outline-none transition-colors focus-visible:shadow-[0_0_0_3px_var(--ring)] data-checked:border-accent data-checked:bg-accent data-indeterminate:border-accent data-indeterminate:bg-accent data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator
        className="flex text-white data-unchecked:hidden"
        render={(p, state) => <span {...p}>{state.indeterminate ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}</span>}
      />
    </BaseCheckbox.Root>
  );
}
