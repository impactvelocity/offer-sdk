"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { MarkerTone } from "@/components/diagrams/kit";
import { cn } from "@/lib/utils";

export interface FeatureTab {
  id: string;
  label: string;
  /** One line under the label in the tab. */
  blurb: string;
  icon: ReactNode;
  tone: MarkerTone;
  title: string;
  body: string;
  points: string[];
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
              className="group relative flex flex-col items-start gap-1 bg-canvas px-4 py-3.5 text-left outline-none transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle data-active:bg-panel"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-fg-tertiary transition-colors group-data-active:text-fg [&_svg]:size-4 [&_svg]:text-fg-icon [&_svg]:transition-colors group-data-active:[&_svg]:text-(--tone)">
                {t.icon}
                {t.label}
              </span>
              <span className="text-xs text-fg-muted">{t.blurb}</span>
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
            className="feature-in mt-10 grid items-center gap-10 outline-none lg:grid-cols-[5fr_7fr] lg:gap-14"
          >
            <div>
              <h3 className="font-display text-3xl font-semibold text-balance">{t.title}</h3>
              <p className="mt-4 text-fg-muted">{t.body}</p>
              <ul className="mt-6 space-y-2.5">
                {t.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm text-fg-secondary">
                    <span className="mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--tone)_18%,transparent)] text-(--tone)">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="feature-frame">{t.visual}</div>
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </div>
  );
}
