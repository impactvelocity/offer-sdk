"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof BaseSwitch.Root> & { className?: string }) {
  return (
    <BaseSwitch.Root
      className={cn(
        "relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full bg-border-strong p-[2px] outline-none transition-colors duration-150 focus-visible:shadow-[0_0_0_3px_var(--ring)] data-checked:bg-accent data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb className="block size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-150 data-checked:translate-x-3" />
    </BaseSwitch.Root>
  );
}
