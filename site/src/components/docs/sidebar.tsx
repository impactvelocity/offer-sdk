"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DOCS_NAV, DOCS_PAGES, isCurrent } from "./nav";

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <div className="flex flex-col gap-8">
      {DOCS_NAV.map((group) => (
        <div key={group.title}>
          <p className="text-sm font-medium text-fg">{group.title}</p>
          <ul className="mt-3 flex flex-col border-l border-border">
            {group.items.map((item) => {
              const current = isCurrent(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "focus-ring -ml-px block border-l py-1.5 pl-4 text-sm transition-colors",
                      current
                        ? "border-accent text-accent-fg"
                        : "border-transparent text-fg-tertiary hover:border-border-strong hover:text-fg",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Left column on large screens: every group, the current page marked on the hairline rule. */
export function DocsSidebar() {
  return (
    <nav aria-label="Docs">
      <NavLinks pathname={usePathname()} />
    </nav>
  );
}

/** Below `lg`: a bar under the site header that opens the same nav. It closes on navigation. */
export function DocsMobileNav() {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const current = DOCS_PAGES.find((page) => isCurrent(page.href, pathname));

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-canvas/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="docs-mobile-nav"
        onClick={() => setOpenOn(open ? null : pathname)}
        className="focus-ring flex h-12 w-full items-center gap-2 rounded-md text-left text-sm"
      >
        <span className="text-fg-tertiary">Docs</span>
        <span className="text-fg-icon" aria-hidden>
          /
        </span>
        <span className="min-w-0 flex-1 truncate text-fg">{current?.title ?? "Menu"}</span>
        <ChevronDown className={cn("size-4 text-fg-icon transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <nav id="docs-mobile-nav" aria-label="Docs" className="max-h-[70dvh] overflow-y-auto pt-2 pb-6">
          <NavLinks pathname={pathname} />
        </nav>
      ) : null}
    </div>
  );
}
