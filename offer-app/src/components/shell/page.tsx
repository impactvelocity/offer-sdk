import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MobileNavButton } from "./mobile-nav";

export interface Crumb {
  label: ReactNode;
  href?: string;
  icon?: ReactNode;
}

/**
 * Attio's 48px top bar: icon + title (or breadcrumbs) on the left, actions on the right.
 */
export function PageHeader({
  title,
  icon,
  crumbs,
  actions,
  badge,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <MobileNavButton />
        {crumbs?.map((c, i) => (
          <Fragment key={i}>
            {c.href ? (
              <Link
                href={c.href}
                className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg [&_svg]:size-4 [&_svg]:text-fg-icon"
              >
                {c.icon}
                <span className="truncate">{c.label}</span>
              </Link>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 px-1.5 text-sm text-fg-secondary [&_svg]:size-4 [&_svg]:text-fg-icon">
                {c.icon}
                <span className="truncate">{c.label}</span>
              </span>
            )}
            <ChevronRight className="size-4 shrink-0 text-fg-placeholder" />
          </Fragment>
        ))}
        {icon && !crumbs?.length ? <span className="flex text-fg-icon [&_svg]:size-[18px]">{icon}</span> : null}
        {title ? <h1 className="truncate px-0.5 text-base font-semibold text-fg">{title}</h1> : null}
        {badge}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Secondary bar under the header for search, filters and view options. */
export function Toolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-14 shrink-0 flex-wrap items-center gap-2.5 border-b border-border px-6 py-2.5", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Scrollable page body. `width` constrains content for document-style pages. */
export function PageBody({
  children,
  className,
  width = "full",
}: {
  children: ReactNode;
  className?: string;
  width?: "full" | "wide" | "narrow";
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
      <div
        className={cn(
          width === "narrow" && "mx-auto w-full max-w-[720px] px-8 py-10",
          width === "wide" && "mx-auto w-full max-w-[1120px] px-8 py-8",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Page title block for document-style pages (settings, developers). */
export function PageTitle({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 border-b border-border pb-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-fg">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-fg-tertiary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
