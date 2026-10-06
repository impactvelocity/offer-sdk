"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { requests, Stage, STEPS } from "./stage";

type Phase = "build" | "ask" | "pain" | "fix";

const chapters: { kicker: string; title: string; body: string; phase: Phase }[] = [
  {
    kicker: "Day 0 · The idea",
    title: "You have an idea",
    body: "An AI writing assistant for busy founders. You can see it so clearly that you start building that night.",
    phase: "build",
  },
  {
    kicker: "Month 1 · You build it",
    title: "Features are the hard part. Right?",
    body: "Editor, AI rewrites, exports, templates, team seats. Pricing can wait until launch.",
    phase: "build",
  },
  {
    kicker: "Launch day · Three plans",
    title: "Three plans. Simple.",
    body: "Starter, Pro and Team. You map features to plans in a config file, add a paywall check and ship. Clean, for about a week.",
    phase: "build",
  },
  {
    kicker: "Week 2 · The first ask",
    title: "A customer wants a longer trial",
    body: "Easy enough. It's one customer, so it's one special case.",
    phase: "ask",
  },
  {
    kicker: "Week 4 · Another one",
    title: "Someone wants more credits, not Pro",
    body: "That's not a plan you have, so you hardcode a credit bump for one account and redeploy.",
    phase: "ask",
  },
  {
    kicker: "Month 2 · A paid exception",
    title: "A Starter team wants one Pro feature",
    body: "They'll pay for it. Now a Starter account has exports, and your paywall, your billing and your UI all need to know.",
    phase: "ask",
  },
  {
    kicker: "Month 3 · A big opportunity",
    title: "An influencer wants a better deal",
    body: "50 more credits than usual for her audience, live before her video on Friday. A great deal, if you can ship it in time.",
    phase: "ask",
  },
  {
    kicker: "Month 4 · The pile-up",
    title: "Every deal is now a deploy",
    body: "Four customers, four special cases scattered across billing, paywall and signup. Nobody remembers why Acme has exports, and nobody knows who actually uses them. Saying yes got expensive.",
    phase: "pain",
  },
  {
    kicker: "The other path · Offer SDK",
    title: "Or every request is a few clicks",
    body: "Plans, entitlements, add-ons, incentives and offers live in Offer SDK. Your app asks one question, what can this account do, and every deal becomes data instead of code.",
    phase: "fix",
  },
  {
    kicker: "Today · Say yes to every buyer",
    title: "And you finally see what sells",
    body: "Usage per feature shows what people actually use, so the next package is a decision, not a guess. Checkout runs through PayPal, and none of it touches your code.",
    phase: "fix",
  },
];

const phaseColor: Record<Phase, string> = {
  build: "text-accent-fg",
  ask: "text-warning-fg",
  pain: "text-danger-fg",
  fix: "text-success-fg",
};

const phaseDot: Record<Phase, string> = {
  build: "bg-accent",
  ask: "bg-warning",
  pain: "bg-danger",
  fix: "bg-success",
};

/**
 * Scrollytelling: chapters scroll on the left while the stage on the right stays pinned and
 * changes with whichever chapter crosses the middle of the screen. On small screens each chapter
 * shows its own stage inline instead.
 */
export function Story() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of refs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <ol className="relative">
        {/* Progress rail: fills to the active chapter. */}
        <span aria-hidden className="absolute top-0 bottom-0 left-[7px] hidden w-px bg-border lg:block" />
        {chapters.map((c, i) => {
          const request = requests[i];
          return (
            <li
              key={c.title}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-index={i}
              className={cn(
                "relative py-10 transition-opacity duration-500 lg:flex lg:min-h-[80svh] lg:flex-col lg:justify-center lg:py-0 lg:pl-10",
                i === active ? "opacity-100" : "lg:opacity-30",
                i === STEPS.sdk && "mt-10 border-t border-border pt-16 lg:mt-24 lg:border-t-0 lg:pt-0",
              )}
            >
<p className={cn("relative text-xs font-medium tracking-wide uppercase", phaseColor[c.phase])}>
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 -left-10 hidden size-[15px] -translate-y-1/2 rounded-full border-[3px] border-canvas transition-colors duration-500 lg:block",
                    i <= active ? phaseDot[c.phase] : "bg-border-strong",
                  )}
                />
                {c.kicker}
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-balance sm:text-4xl">{c.title}</h2>
              {request ? (
                <blockquote className="mt-4 border-l-2 border-warning/60 pl-4 text-lg text-fg-secondary">
                  “{request.quote}”
                </blockquote>
              ) : null}
              <p className="mt-4 max-w-md text-fg-muted">{c.body}</p>
              <div className="mt-8 lg:hidden">
                <Stage step={i} />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="hidden lg:block">
        <div className="sticky top-20 flex h-[calc(100svh-6rem)] items-center">
          <Stage step={active} />
        </div>
      </div>
    </div>
  );
}
