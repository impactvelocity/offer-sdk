import { Layers2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** `bare`: just the glyph, no tile (the shell rail). */
export function LogoMark({ className, bare }: { className?: string; bare?: boolean }) {
  if (bare) return <Layers2 aria-hidden className={cn("size-6 shrink-0 text-fg", className)} strokeWidth={2.25} />;
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
