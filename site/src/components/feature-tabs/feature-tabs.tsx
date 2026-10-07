"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { MarkerTone } from "@/components/diagrams/kit";
import { cn } from "@/lib/utils";

export interface FeatureTab {
  id: string;
  label: string;
  tone: MarkerTone;
  title: string;
  body: string;
  visual: ReactNode;
}

const toneStyle = (tone: MarkerTone) => ({ "--tone": `var(--marker-${tone})` }) as CSSProperties;

/**
 * Tabbed product tour. Tabs advance on their own (a progress bar fills under the active one,
 * paused while hovered or off screen) until the visitor picks one; then they stay put. With
 * reduced motion the bar doesn't animate, so it never ends and the tabs don't advance.
 */
export function FeatureTabs({ tabs }: { tabs: FeatureTab[] }) {
  const [value, setValue] = useState(tabs[0]!.id);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // "In view" = crossing the middle half of the viewport, so it works when the block is taller than the screen.
    const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), {
      rootMargin: "-25% 0px -25% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const next = () => setValue((v) => tabs[(tabs.findIndex((t) => t.id === v) + 1) % tabs.length]!.id);

  return (
    <div ref={ref} className="group/tabs">
      <Tabs.Root
        value={value}
        onValueChange={(v) => {
          setValue(v as string);
          setAuto(false);
        }}
      >
        <Tabs.List className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {tabs.map((t) => (
            <Tabs.Tab
              key={t.id}
              value={t.id}
              style={toneStyle(t.tone)}
              className="group relative flex items-center bg-canvas px-5 py-4 text-left outline-none transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle data-active:bg-panel"
            >
              <span className="text-base font-medium text-fg-tertiary transition-colors group-data-active:text-fg sm:text-lg">
                {t.label}
              </span>
              {t.id === value ? (
                <span
                  key={`${t.id}-${auto}`}
                  aria-hidden
                  data-paused={!inView}
                  onAnimationEnd={auto ? next : undefined}
                  className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left bg-(--tone)", auto && "tab-progress")}
                />
              ) : null}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {tabs.map((t) => (
          <Tabs.Panel
            key={t.id}
            value={t.id}
            style={toneStyle(t.tone)}
            // minmax(0, …) columns let wide visuals shrink to the screen instead of widening the page.
            className="feature-in mt-10 grid grid-cols-1 items-center gap-10 outline-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14"
          >
            <div>
              <h3 className="font-display text-2xl font-medium text-balance sm:text-3xl">{t.title}</h3>
              <p className="mt-4 text-lg/8 text-pretty text-fg-muted">{t.body}</p>
            </div>
            <div>{t.visual}</div>
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </div>
  );
}
