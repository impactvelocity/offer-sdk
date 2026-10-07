import type { ComponentType, CSSProperties } from "react";
import {
  AddonsDiagram,
  EntitlementsDiagram,
  IncentivesDiagram,
  OffersDiagram,
  PlansDiagram,
} from "@/components/diagrams/primitives";
import type { MarkerTone } from "@/components/diagrams/kit";
import { DiagramReveal } from "@/components/diagrams/reveal";
import type { Primitive } from "@/components/sections/primitive-chip";
import { cn } from "@/lib/utils";

export const primitives: { title: Primitive; body: string; tone: MarkerTone; Diagram: ComponentType }[] = [
  {
    title: "Plans",
    body: "The tiers that set a customer's baseline. Every account always sits on one core plan.",
    tone: "green",
    Diagram: PlansDiagram,
  },
  {
    title: "Entitlements",
    body: "The features and limits a plan unlocks, resolved into one answer your app can check.",
    tone: "violet",
    Diagram: EntitlementsDiagram,
  },
  {
    title: "Add-ons",
    body: "Extra features or capacity that snap onto any plan, without minting a new tier.",
    tone: "orange",
    Diagram: AddonsDiagram,
  },
  {
    title: "Incentives",
    body: "Discounts, trials and grants applied on top of a plan, for a set time or number of cycles.",
    tone: "pink",
    Diagram: IncentivesDiagram,
  },
  {
    title: "Offers",
    body: "One or more plans with their prices, order bumps and extra entitlements, behind one link that checks out with PayPal.",
    tone: "blue",
    Diagram: OffersDiagram,
  },
];

// Plans and Offers lead (what you sell), then the three pieces that shape them.
const top: Primitive[] = ["Plans", "Offers"];

/**
 * Plans and Offers side by side, then Entitlements, Add-ons and Incentives in a row of three.
 * Each cell has its name as a badge floating at the top left, its line diagram (drawn on when
 * scrolled into view, animated on hover), and a one-line statement of what it does.
 */
export function PlatformPrimitives({ className }: { className?: string }) {
  const ordered = [
    ...primitives.filter((p) => top.includes(p.title)),
    ...primitives.filter((p) => !top.includes(p.title)),
  ];
  return (
    <div className={cn("grid gap-y-16 md:grid-cols-2 lg:grid-cols-6", className)}>
      {ordered.map(({ title, body, tone, Diagram }) => (
        <article
          key={title}
          style={toneStyle(tone)}
          className={cn(
            "diagram-cell group relative flex flex-col border-l border-border px-6 pt-1",
            top.includes(title) ? "lg:col-span-3" : "lg:col-span-2",
          )}
        >
          {/* Soft badge tinted with the cell's tone, white text. */}
          <span className="absolute top-0 left-6 z-10 inline-flex h-10 items-center rounded-md bg-[color-mix(in_oklch,var(--tone)_28%,transparent)] px-5 text-lg font-medium text-white">
            {title}
          </span>
          <DiagramReveal className="mx-auto my-10 w-full max-w-[380px]">
            <Diagram />
          </DiagramReveal>
          <p className="max-w-md text-base text-pretty text-fg-secondary">{body}</p>
        </article>
      ))}
    </div>
  );
}

/** Sets the hover tone that the diagram cell's glow, faces, edges and tints pick up. */
export function toneStyle(tone: MarkerTone) {
  return { "--tone": `var(--marker-${tone})` } as CSSProperties;
}
