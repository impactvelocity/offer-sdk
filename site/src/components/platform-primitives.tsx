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
import { cn } from "@/lib/utils";

export const primitives: { title: string; body: string; tone: MarkerTone; Diagram: ComponentType }[] = [
  {
    title: "Plans",
    body: "The tiers that set a customer's baseline. Every account always sits on one core plan.",
    tone: "violet",
    Diagram: PlansDiagram,
  },
  {
    title: "Entitlements",
    body: "The features and limits a plan unlocks, resolved into one answer your app can check.",
    tone: "teal",
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
    body: "A plan, its bumps and an incentive packaged behind one link that checks out with PayPal.",
    tone: "blue",
    Diagram: OffersDiagram,
  },
];

/**
 * Modal-style cells: the four building blocks in a 2×2 grid, then Offers (which packages them)
 * across the full width. Each has a number, its line diagram (drawn on when scrolled into view,
 * animated on hover), title and copy.
 */
export function PlatformPrimitives({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-y-16 md:grid-cols-2", className)}>
      {primitives.map(({ title, body, tone, Diagram }, i) => {
        const wide = i === primitives.length - 1;
        return (
          <article
            key={title}
            style={toneStyle(tone)}
            className={cn(
              "diagram-cell group flex flex-col border-l border-border px-6 pt-1",
              wide && "md:col-span-2 md:flex-row md:items-center md:gap-12",
            )}
          >
            <span className={cn("text-xs text-fg-tertiary tabular", wide && "md:self-start")}>{i + 1}</span>
            <DiagramReveal className={cn("mx-auto my-8 w-full max-w-[380px]", wide && "md:mx-0 md:shrink-0")}>
              <Diagram />
            </DiagramReveal>
            <div>
              <h3 className="text-lg font-medium text-fg">{title}</h3>
              <p className="mt-2 max-w-md text-sm text-fg-muted">{body}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Sets the hover tone that the diagram cell's glow, faces, edges and tints pick up. */
export function toneStyle(tone: MarkerTone) {
  return { "--tone": `var(--marker-${tone})` } as CSSProperties;
}
