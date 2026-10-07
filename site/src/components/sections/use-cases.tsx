import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { MarkerTone } from "@/components/diagrams/kit";
import { DiagramReveal } from "@/components/diagrams/reveal";
import {
  AbTestDiagram,
  ChurnDiagram,
  FunnelDiagram,
  PartnerDiagram,
  PromoDiagram,
  UpsellDiagram,
} from "@/components/diagrams/use-cases";
import { SectionArt } from "@/components/section-art";
import { SectionHeading } from "@/components/section-heading";
import { cn } from "@/lib/utils";

const funnel: { step: string; offer: string; price: string; grants: string[] }[] = [
  { step: "Front-end offer", offer: "Pro plan", price: "$29/mo", grants: ["Pro features", "1,000 credits"] },
  { step: "Order bump", offer: "Resource pack", price: "+$19", grants: ["Templates add-on", "Instant delivery"] },
  { step: "Upsell", offer: "Go yearly", price: "$249/yr", grants: ["2 months free", "+2,000 credits"] },
  { step: "Downsell", offer: "Starter", price: "$9/mo", grants: ["Core features", "200 credits"] },
];

const cases: { title: string; body: string; tone: MarkerTone; Diagram: ComponentType; detail: ReactNode }[] = [
  {
    title: "Upsells at the limit",
    body: "When an account runs low on credits, show the next plan up and take payment through PayPal.",
    tone: "green",
    Diagram: UpsellDiagram,
    detail: <Detail>Upgrade shown at 90% of the credit limit</Detail>,
  },
  {
    title: "Churn saves",
    body: "Give more instead of discounting. Add credits or seats the moment someone clicks cancel.",
    tone: "pink",
    Diagram: ChurnDiagram,
    detail: <Detail>+500 credits and 5 seats granted</Detail>,
  },
  {
    title: "Partner bundles",
    body: "Make a bundle for one partner. Buyers from their link are credited to them and get access on their own.",
    tone: "blue",
    Diagram: PartnerDiagram,
    detail: <Detail>offer.to/sarah · auto-credited</Detail>,
  },
  {
    title: "Time-limited promos",
    body: "Launch a Black Friday price with an end date. When it passes, the link stops selling and there's no code to clean up.",
    tone: "orange",
    Diagram: PromoDiagram,
    detail: <Detail>BF24 ends Sunday at midnight</Detail>,
  },
  {
    title: "Pricing tests",
    body: "Put two packages on two links and compare how many buyers check out on each.",
    tone: "violet",
    Diagram: AbTestDiagram,
    detail: (
      <span className="flex w-full flex-wrap gap-1.5">
        <Detail>A · Pro $29</Detail>
        <Detail>B · Pro + credits $35</Detail>
      </span>
    ),
  },
];

// Cards sit on the panel color, so the diagrams' faces fill with it too.
export const cardStyle = (tone: MarkerTone) =>
  ({ "--tone": `var(--marker-${tone})`, "--diagram-bg": "var(--panel)" }) as CSSProperties;

/**
 * Use cases on the section artwork: the funnel across the full width, then one card per case.
 * Every card leads with its own line diagram (drawn on when scrolled into view, animated on hover).
 */
export function UseCasesSection() {
  return (
    <SectionArt id="use-cases" artClassName="opacity-12">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          title="Funnels, partner deals and promos."
          lead="Launch each one from the dashboard."
        />

        <article
          style={cardStyle("green")}
          className="diagram-cell group mt-16 grid items-center gap-8 rounded-2xl border border-border bg-panel p-6 shadow-lg sm:p-8 lg:grid-cols-[2fr_5fr]"
        >
          <DiagramReveal className="mx-auto w-full max-w-[280px]">
            <FunnelDiagram />
          </DiagramReveal>
          <div>
            <h3 className="max-w-xl text-xl">
              <span className="text-fg">Funnels with bumps, upsells and downsells.</span>{" "}
              <span className="text-fg-muted">
                Each step grants its own features, credits or add-ons. Change a step in the dashboard and the next
                buyer gets the new access.
              </span>
            </h3>
            <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
              {funnel.map((s, i) => (
                <li key={s.step} className="bg-bg p-4">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-fg-tertiary">
                      <span className="font-mono tabular">0{i + 1}</span> {s.step}
                    </span>
                    <span className="font-mono text-fg-secondary tabular">{s.price}</span>
                  </div>
                  <p className="mt-4 font-medium text-fg">{s.offer}</p>
                  <p className="mt-1 text-xs text-fg-muted">{s.grants.join(" · ")}</p>
                </li>
              ))}
            </ol>
          </div>
        </article>

        <div className="mt-4 grid gap-4 md:grid-cols-6">
          {cases.map(({ title, body, tone, Diagram, detail }, i) => (
            <article
              key={title}
              style={cardStyle(tone)}
              className={cn(
                "diagram-cell group flex flex-col rounded-2xl border border-border bg-panel p-6 shadow-lg",
                // Three across, then two wider cards.
                i < 3 ? "md:col-span-2" : "md:col-span-3",
              )}
            >
              <DiagramReveal className="mx-auto mb-6 w-full max-w-[260px]">
                <Diagram />
              </DiagramReveal>
              <h3 className="text-lg font-medium text-fg">{title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{body}</p>
              <div className="mt-auto flex pt-6">{detail}</div>
            </article>
          ))}
        </div>
      </div>
    </SectionArt>
  );
}

function Detail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg-secondary", className)}>
      {children}
    </span>
  );
}
