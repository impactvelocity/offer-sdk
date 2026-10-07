"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/** Hamburger for narrow screens: opens the header's page links in a panel under the header. */
export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // The path the menu was opened on, so navigating anywhere closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-mr-2 w-8 px-0 [&_svg]:size-5" })}
      >
        {open ? <X /> : <Menu />}
      </button>
      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-canvas px-4 pt-2 pb-4 shadow-2xl shadow-black/50 sm:px-6"
      >
        <ul className="mx-auto max-w-6xl divide-y divide-border">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  "focus-ring flex rounded-sm py-3.5 text-base transition-colors hover:text-fg",
                  pathname === item.href || pathname.startsWith(`${item.href}/`) ? "text-fg" : "text-fg-secondary",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
