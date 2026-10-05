import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Attio's record "Details" list: icon + label on the left, value on the right. */
export function PropertyList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col", className)}>{children}</dl>;
}

export function Property({ icon, label, children }: { icon?: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[128px_minmax(0,1fr)] items-center gap-3 py-1">
      <dt className="flex items-center gap-2 text-sm text-fg-tertiary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-icon">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0 text-sm text-fg">{children}</dd>
    </div>
  );
}
