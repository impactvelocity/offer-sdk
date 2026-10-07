"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Heading = { id: string; text: string; level: 2 | 3 };

/** Clears the sticky header (56px) plus some air, so a heading counts as current just below it. */
const OFFSET = 120;

function readHeadings(): Heading[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-docs-article] :is(h2, h3)[id]")).map((el) => ({
    id: el.id,
    text: el.dataset.tocLabel ?? el.textContent ?? "",
    level: el.tagName === "H3" ? 3 : 2,
  }));
}

/** "On this page": the article's h2/h3 headings, with the one you're reading highlighted. */
export function DocsToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const list = readHeadings();
      setHeadings(list);
      // The last heading scrolled past the top; at the very bottom, the last one.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = list[0]?.id ?? null;
      for (const h of list) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top <= OFFSET) current = h.id;
      }
      setActive(atBottom ? (list.at(-1)?.id ?? current) : current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [pathname]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page">
      <p className="text-sm font-medium text-fg">On this page</p>
      <ul className="mt-3 flex flex-col gap-0.5">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? "location" : undefined}
              className={cn(
                "focus-ring block rounded-sm py-1 text-[13px] leading-5 transition-colors",
                h.level === 3 && "pl-3",
                active === h.id ? "text-accent-fg" : "text-fg-tertiary hover:text-fg",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
