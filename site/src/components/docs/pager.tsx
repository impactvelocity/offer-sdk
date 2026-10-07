"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DOCS_PAGES, isCurrent, type DocsLink } from "./nav";

function PagerLink({ page, direction }: { page: DocsLink; direction: "prev" | "next" }) {
  const next = direction === "next";
  return (
    <Link
      href={page.href}
      className={cn(
        "focus-ring group flex flex-col gap-1 rounded-xl border border-border bg-panel px-5 py-4 transition-colors hover:border-border-strong hover:bg-bg",
        next && "items-end text-right sm:col-start-2",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm text-fg-tertiary">
        {next ? null : <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />}
        {next ? "Next" : "Previous"}
        {next ? <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
      </span>
      <span className="text-base font-medium text-fg">{page.title}</span>
    </Link>
  );
}

/** Previous / next page in sidebar order, at the foot of every docs page. */
export function DocsPager() {
  const pathname = usePathname();
  const index = DOCS_PAGES.findIndex((page) => isCurrent(page.href, pathname));
  if (index === -1) return null;
  const prev = DOCS_PAGES[index - 1];
  const next = DOCS_PAGES[index + 1];

  return (
    <nav aria-label="Pagination" className="mt-20 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
      {prev ? <PagerLink page={prev} direction="prev" /> : null}
      {next ? <PagerLink page={next} direction="next" /> : null}
    </nav>
  );
}
