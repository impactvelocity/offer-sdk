import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Attio-style grid: hairline borders between cells, compact rows, header icons.

export function TableContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative w-full overflow-x-auto scrollbar-thin", className)}>{children}</div>;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-separate border-spacing-0 text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("sticky top-0 z-10 bg-bg", className)} {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TR({ className, interactive, ...props }: ComponentProps<"tr"> & { interactive?: boolean }) {
  return (
    <tr
      className={cn("group/row", interactive && "cursor-pointer [&>td]:hover:bg-bg-subtle", className)}
      {...props}
    />
  );
}

export function TH({
  className,
  icon,
  children,
  align = "left",
  ...props
}: ComponentProps<"th"> & { icon?: ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "h-11 border-b border-r border-border px-4 text-left text-sm font-medium whitespace-nowrap text-fg-secondary last:border-r-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-1.5", align === "right" && "flex-row-reverse")}>
        {icon ? <span className="flex text-fg-icon [&_svg]:size-4">{icon}</span> : null}
        {children}
      </span>
    </th>
  );
}

export function TD({ className, align = "left", ...props }: ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "h-12 border-b border-r border-border px-4 align-middle text-sm text-fg last:border-r-0",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/** Footer row with a record count, like Attio's "13 count". */
export function TableFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-11 items-center gap-3 border-b border-border px-4 text-sm text-fg-tertiary", className)}>
      {children}
    </div>
  );
}

export function EmptyCell({ children = "—" }: { children?: ReactNode }) {
  return <span className="text-fg-placeholder">{children}</span>;
}
