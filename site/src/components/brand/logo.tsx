import { Layers2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return <Layers2 className={cn("size-[22px] shrink-0 text-accent", className)} strokeWidth={2} aria-hidden />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-[18px]" />
      <span className="font-display text-[18px] font-semibold tracking-tight text-fg">Offer SDK</span>
    </span>
  );
}
