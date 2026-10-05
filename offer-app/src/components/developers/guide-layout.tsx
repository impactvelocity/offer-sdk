"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { endpointId, type HttpMethod } from "./endpoints";

/** A numbered step in a docs-style page. */
export function GuideSection({
  id,
  step,
  title,
  description,
  children,
  className,
}: {
  id: string;
  step: number;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6 border-t border-border py-8 first:border-t-0 first:pt-0", className)}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-semibold tabular text-fg-secondary">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
          {description ? <div className="mt-1 text-sm text-fg-secondary">{description}</div> : null}
        </div>
      </div>
      <div className="flex flex-col gap-4 sm:pl-9">{children}</div>
    </section>
  );
}

/** Tracks which section is under the top of the viewport. Pass `ready` once the sections are rendered. */
export function useActiveSection(ids: string[], ready = true) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(",");

  useEffect(() => {
    if (!ready) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = key.split(",").find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const id of key.split(",")) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key, ready]);

  return active;
}

export function OnThisPage({ sections, active }: { sections: { id: string; title: string }[]; active: string }) {
  return (
    <nav aria-label="On this page" className="sticky top-8 flex flex-col gap-0.5">
      <p className="mb-1.5 px-2 text-xs font-medium text-fg-tertiary">On this page</p>
      {sections.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "location" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-bg-hover hover:text-fg",
            active === s.id ? "font-medium text-fg" : "text-fg-tertiary",
          )}
        >
          <span className="w-3 shrink-0 text-xs tabular text-fg-placeholder">{i + 1}</span>
          <span className="truncate">{s.title}</span>
        </a>
      ))}
    </nav>
  );
}

/** "POST /namespaces ↗" link into the API reference. */
export function RefLink({ appId, method, path }: { appId: string; method: HttpMethod; path: string }) {
  const short = path.replace(/^\/apps\/:appId/, "");
  return (
    <Link
      href={`/apps/${appId}/developers/api#${endpointId({ method, path })}`}
      className="inline-flex items-center gap-1 rounded-md text-xs text-fg-tertiary transition-colors hover:text-accent-fg focus-ring"
    >
      <span className="font-mono">
        {method} {short}
      </span>
      <ArrowUpRight className="size-3" />
    </Link>
  );
}
