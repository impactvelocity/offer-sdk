import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { box: "border-border bg-bg-subtle text-fg-secondary", icon: <Info className="text-fg-icon" /> },
  warning: { box: "border-warning/30 bg-warning-subtle text-warning-fg", icon: <TriangleAlert className="text-warning" /> },
  danger: { box: "border-danger/25 bg-danger-subtle text-danger-fg", icon: <CircleAlert className="text-danger" /> },
};

/** Inline notice with an optional title and an action on the right. */
export function Callout({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "info" ? undefined : "alert"}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", action && !title && "items-center py-2.5", tones[tone].box, className)}
    >
      <span className={cn("flex shrink-0 [&_svg]:size-4", (title || !action) && "mt-0.5")}>{tones[tone].icon}</span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "[&_a]:underline [&_a]:underline-offset-2")}>{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
