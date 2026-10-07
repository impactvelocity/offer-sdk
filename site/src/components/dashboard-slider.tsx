"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import accounts from "@/assets/screens/accounts.webp";
import addOns from "@/assets/screens/add-ons.webp";
import agent from "@/assets/screens/agent.webp";
import analytics from "@/assets/screens/analytics.webp";
import apiReference from "@/assets/screens/api-reference.webp";
import appSettings from "@/assets/screens/app-settings.webp";
import cancelFlow from "@/assets/screens/cancel-flow.webp";
import entitlements from "@/assets/screens/entitlements.webp";
import incentives from "@/assets/screens/incentives.webp";
import integration from "@/assets/screens/integration.webp";
import mcp from "@/assets/screens/mcp.webp";
import offers from "@/assets/screens/offers.webp";
import overview from "@/assets/screens/overview.webp";
import plans from "@/assets/screens/plans.webp";
import webhooks from "@/assets/screens/webhooks.webp";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

interface Screen {
  /** Same as the dashboard's nav label. */
  label: string;
  /** Route the shot was taken on, under /apps/app_lnpSrz. Not shown; kept for retaking shots. */
  path: string;
  image: StaticImageData;
  /** Caption: a bright opening sentence, then a dimmed one that continues it. */
  title: string;
  body: string;
}

// Shot at 1440×900 in dark mode from the demo workspace's "Notebook AI" app (pnpm seed:demo).

const screens: Screen[] = [
  {
    label: "Overview",
    path: "",
    image: overview,
    title: "Your app at a glance.",
    body: "Accounts by plan, active incentives and 30 days of usage on one page.",
  },
  {
    label: "Analytics",
    path: "/analytics",
    image: analytics,
    title: "See usage per entitlement.",
    body: "Pick a range, focus on one entitlement and save the view as a report.",
  },
  {
    label: "Agent",
    path: "/agent",
    image: agent,
    title: "Ask the Agent to change the catalog.",
    body: "It looks up plans and accounts, and every change waits on a diff you approve.",
  },
  {
    label: "Offers",
    path: "/offers/new",
    image: offers,
    title: "Build an offer and watch the checkout update.",
    body: "Discounts, plans and extras on one link that buyers pay through PayPal.",
  },
  {
    label: "Cancel flow",
    path: "/cancel-flow/edit",
    image: cancelFlow,
    title: "Ask why before they cancel.",
    body: "Write the questions, then let the agent pick a discount, pause or downgrade from the answer.",
  },
  {
    label: "Plans",
    path: "/plans/pro",
    image: plans,
    title: "Edit a plan's limits in place.",
    body: "The SDK response beside them shows what your app gets on the next request.",
  },
  {
    label: "Entitlements",
    path: "/entitlements",
    image: entitlements,
    title: "Define each limit and feature flag once.",
    body: "Plans, add-ons and incentives all build on the same list.",
  },
  {
    label: "Add-ons",
    path: "/addons",
    image: addOns,
    title: "Sell extras on top of a plan.",
    body: "More storage, an AI boost or white-labelling, included in plans or added at checkout.",
  },
  {
    label: "Incentives",
    path: "/incentives/black_friday_2026",
    image: incentives,
    title: "Give a group of accounts more without changing their plan.",
    body: "This one doubles AI credits and storage for every account it's applied to.",
  },
  {
    label: "Accounts",
    path: "/accounts/usr_48383",
    image: accounts,
    title: "Open any account to see what it can use.",
    body: "Its plan, incentive overrides and usage against each limit, plus a simulator for tracking calls.",
  },
  {
    label: "Integration",
    path: "/developers",
    image: integration,
    title: "Wire it up once.",
    body: "Keys, the base URL and snippets for creating accounts, checking access and tracking usage.",
  },
  {
    label: "API reference",
    path: "/developers/api",
    image: apiReference,
    title: "Every endpoint, grouped by resource.",
    body: "68 routes, each marked with the key it accepts.",
  },
  {
    label: "MCP server",
    path: "/developers/mcp",
    image: mcp,
    title: "Connect AI assistants to your app.",
    body: "Give AI assistants and coding agents the same tools as the API, with OAuth, access levels and an activity log.",
  },
  {
    label: "Webhooks",
    path: "/developers/webhooks",
    image: webhooks,
    title: "Send events to the rest of your stack.",
    body: "Signed webhooks for plan changes and usage limits, or connect Zapier and skip the code.",
  },
  {
    label: "App settings",
    path: "/settings",
    image: appSettings,
    title: "Get paid in your own PayPal account.",
    body: "Connect your PayPal REST app for sandbox and live, and buyers pay you directly.",
  },
];

/**
 * Screenshots of every dashboard page in a rounded frame. Pick a page from the strip above it,
 * use the arrows (or arrow keys), or swipe on touch screens; the caption below follows along.
 */
export function DashboardSlider({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipeFrom = useRef<number | null>(null);
  const screen = screens[index]!;

  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), screens.length - 1));

  // Keep the active page name in view on narrow screens, without scrolling the page itself.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = tabRefs.current[index];
    if (!strip || !tab) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({
      left: tab.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [index]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "ArrowRight") go(index + 1);
    else return;
    e.preventDefault();
  };

  // Touch swipes only; mouse users have the arrows and the strip.
  const onPointerDown = (e: PointerEvent) => {
    swipeFrom.current = e.pointerType === "mouse" ? null : e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipeFrom.current === null) return;
    const dx = e.clientX - swipeFrom.current;
    swipeFrom.current = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Dashboard screenshots"
      onKeyDown={onKeyDown}
      className={cn("relative", className)}
    >
      <div
        ref={stripRef}
        // Scrolls (with faded edges) until there's room to wrap onto two rows.
        className="-mx-4 flex gap-1 overflow-x-auto px-4 py-1 [mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-1rem),transparent)] [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        {screens.map((s, i) => (
          <button
            key={s.label}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            aria-current={i === index ? "true" : undefined}
            onClick={() => go(i)}
            className={cn(
              "focus-ring shrink-0 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              i === index
                ? "bg-bg-hover text-fg ring-1 ring-inset ring-border-strong"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative mt-5">
        <div className="absolute -inset-x-10 -top-10 -bottom-10 -z-10 bg-brand-glow blur-2xl" aria-hidden />
        <div className="overflow-hidden rounded-2xl border border-border-strong bg-panel shadow-2xl shadow-black/50">
          <div
            className="overflow-hidden bg-canvas touch-pan-y"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipeFrom.current = null)}
          >
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {screens.map((s, i) => (
                <div
                  key={s.label}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${screens.length}: ${s.label}`}
                  inert={i !== index}
                  className="relative aspect-[16/10] w-full shrink-0"
                >
                  <Image
                    src={s.image}
                    alt={`The ${s.label} page of the Offer SDK dashboard`}
                    fill
                    placeholder="blur"
                    sizes="(min-width: 1152px) 1104px, 100vw"
                    // Lazy images stay unloaded while clipped, so load the neighbours up front.
                    loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                    draggable={false}
                    className="object-cover object-top select-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-start justify-between gap-6">
        <p aria-live="polite" className="max-w-3xl text-lg/8 text-pretty">
          <span className="text-fg">{screen.title}</span> <span className="text-fg-muted">{screen.body}</span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label="Previous page"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className={buttonVariants({ variant: "secondary", size: "md", className: "w-9 px-0" })}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => go(index + 1)}
            disabled={index === screens.length - 1}
            className={buttonVariants({ variant: "secondary", size: "md", className: "w-9 px-0" })}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
