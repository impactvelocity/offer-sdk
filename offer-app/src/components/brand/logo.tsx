import { Layers2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-[27%] border border-border bg-bg-subtle text-fg",
        className,
      )}
    >
      <Layers2 className="size-[62%]" strokeWidth={2.25} />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-[18px] font-semibold tracking-tight text-fg">Offer SDK</span>
    </span>
  );
}
