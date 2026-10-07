import type { Metadata } from "next";
import { DocsPager } from "@/components/docs/pager";
import { DocsMobileNav, DocsSidebar } from "@/components/docs/sidebar";
import { DocsToc } from "@/components/docs/toc";

export const metadata: Metadata = {
  title: { default: "Docs", template: "%s · Offer SDK Docs" },
};

/**
 * Docs shell, after neon.com/docs: nav on the left, the article in the middle, "On this page" on
 * the right. It keeps the header's 6xl width so the logo and the sidebar share an edge. The
 * sidebar folds into a menu bar below `lg`, and the table of contents drops out below `xl`.
 */
export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <DocsMobileNav />
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[13rem_minmax(0,1fr)_11rem]">
        <aside className="hidden lg:block">
          <div className="sticky top-14 -ml-1 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-12 pl-1 [scrollbar-width:thin]">
            <DocsSidebar />
          </div>
        </aside>
        <div className="min-w-0 pt-10 pb-24 lg:pt-12">
          <article data-docs-article className="docs-prose">
            {children}
          </article>
          <DocsPager />
        </div>
        <aside className="hidden xl:block">
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-12">
            <DocsToc />
          </div>
        </aside>
      </div>
    </div>
  );
}
