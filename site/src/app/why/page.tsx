import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { DiagramReveal } from "@/components/diagrams/reveal";
import { primitives } from "@/components/platform-primitives";
import { SectionArt } from "@/components/section-art";
import { SectionHeading } from "@/components/section-heading";
import { PrimitiveChip, type Primitive } from "@/components/sections/primitive-chip";
import { cardStyle } from "@/components/sections/use-cases";
import { WhyTimeline } from "@/components/why/timeline";
import { cn } from "@/lib/utils";

const title = "Every SaaS launches with three plans. Then customers show up.";
const description =
  "This is how pricing turns into spaghetti one reasonable request at a time, and where Offer SDK fits.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/why" });

const asks: { ask: string; hardcoded: string; primitive: Primitive; sdk: string }[] = [
  { ask: "“Can I get a 30-day trial?”", hardcoded: "Email check + deploy", primitive: "Incentives", sdk: "Trial incentive" },
  { ask: "“I just need more credits.”", hardcoded: "Account ID check + deploy", primitive: "Add-ons", sdk: "Credit pack" },
  { ask: "“Exports on Starter?”", hardcoded: "Paywall exception + deploy", primitive: "Entitlements", sdk: "Entitlement on the account" },
  { ask: "“+50 credits for my audience.”", hardcoded: "Referral check with an end date", primitive: "Offers", sdk: "Offer link" },
  { ask: "“Who actually uses exports?”", hardcoded: "Write a query, maybe", primitive: "Entitlements", sdk: "Usage per feature" },
];

export default function WhyPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-brand-glow" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 pt-24 pb-16 sm:px-6 sm:pt-40">
          <h1 className="max-w-4xl font-display text-4xl font-medium text-balance sm:text-5xl lg:text-6xl">
            <span className="text-fg">Every SaaS launches with three plans.</span>{" "}
            <span className="text-fg-muted">Then customers show up.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-fg-tertiary">
            This is how pricing turns into spaghetti one reasonable request at a time, and where Offer SDK fits.
          </p>
        </div>
      </section>

      <WhyTimeline />

      <SectionArt>
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <SectionHeading
            title="Same requests, different outcome."
            lead="Every one of these is a reasonable ask. Only one way of answering them scales."
          />
          <div className="mt-16 grid gap-4 md:grid-cols-6">
            {asks.map((a, i) => {
              const { tone, Diagram } = primitives.find((p) => p.title === a.primitive)!;
              return (
                <article
                  key={a.ask}
                  style={cardStyle(tone)}
                  className={cn(
                    "diagram-cell group flex flex-col rounded-2xl border border-border bg-panel p-6 shadow-lg",
                    // Three across, then two wider cards.
                    i < 3 ? "md:col-span-2" : "md:col-span-3",
                  )}
                >
                  <DiagramReveal className="mx-auto mb-6 w-full max-w-[220px]">
                    <Diagram />
                  </DiagramReveal>
                  <h3 className="text-lg font-medium text-fg">{a.ask}</h3>
                  <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="shrink-0 text-fg-tertiary">Hardcode it</dt>
                      <dd className="text-right text-fg-muted line-through decoration-fg-muted/50">{a.hardcoded}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="shrink-0 text-fg-tertiary">With Offer SDK</dt>
                      <dd className="text-right text-fg">{a.sdk}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex pt-5">
                    <PrimitiveChip name={a.primitive} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </SectionArt>
    </>
  );
}
