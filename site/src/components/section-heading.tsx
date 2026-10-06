import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  className,
}: {
  /** Optional small label above the title. */
  eyebrow?: string;
  title: ReactNode;
  /** Optional paragraph under the title. */
  lead?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow ? <p className="mb-2 text-sm font-medium text-accent-fg">{eyebrow}</p> : null}
      <h2 className="font-display text-3xl font-semibold text-balance sm:text-4xl">{title}</h2>
      {lead ? <p className={cn("mt-4 max-w-xl text-fg-muted", align === "center" && "mx-auto")}>{lead}</p> : null}
    </div>
  );
}
