import { ArrowDown, Check, X } from "lucide-react";
import type { Metadata } from "next";
import { SectionHeading } from "@/components/section-heading";
import { PrimitiveChip, type Primitive } from "@/components/sections/primitive-chip";
import { Story } from "@/components/story/story";
import { Eyebrow } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "The story",
  description: "Every SaaS launches with three plans. Then customers show up. Where Offer SDK fits.",
};

const asks: { ask: string; hardcoded: string; primitive: Primitive; sdk: string }[] = [
  { ask: "“Can I get a 30-day trial?”", hardcoded: "Email check + deploy", primitive: "Incentives", sdk: "Trial incentive" },
  { ask: "“I just need more credits.”", hardcoded: "Account ID check + deploy", primitive: "Add-ons", sdk: "Credit pack" },
  { ask: "“Exports on Starter?”", hardcoded: "Paywall exception + deploy", primitive: "Entitlements", sdk: "Entitlement on the account" },
  { ask: "“+50 credits for my audience.”", hardcoded: "Referral check with an end date", primitive: "Offers", sdk: "Offer link" },
  { ask: "“Who actually uses exports?”", hardcoded: "Write a query, maybe", primitive: "Entitlements", sdk: "Usage per feature" },
];

export default function StoryPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-brand-glow" aria-hidden />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-24 pb-10 text-center sm:px-6 sm:pt-32">
          <Eyebrow lead="Story">A SaaS, from idea to pricing</Eyebrow>
          <h1 className="mt-6 font-display text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
            Every SaaS launches with three plans. <span className="text-brand">Then customers show up.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-fg-muted">
            This is how pricing turns into spaghetti one reasonable request at a time, and where Offer SDK fits.
          </p>
          <span className="mt-12 inline-flex items-center gap-2 text-sm text-fg-tertiary">
            <ArrowDown className="size-4 animate-bounce" /> Scroll to follow along
          </span>
        </div>
      </section>

      <Story />

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading
          eyebrow="Two ways to say yes"
          title="Same requests, different outcome"
          lead="Every one of these is a reasonable ask. Only one way of answering them scales."
        />
        <div className="mt-12 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-panel text-xs text-fg-tertiary">
              <tr>
                <th className="px-5 py-3 font-medium">The ask</th>
                <th className="px-5 py-3 font-medium">Hardcode it</th>
                <th className="px-5 py-3 font-medium">With Offer SDK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {asks.map((a) => (
                <tr key={a.ask}>
                  <td className="px-5 py-4 text-fg">{a.ask}</td>
                  <td className="px-5 py-4 text-fg-muted">
                    <span className="inline-flex items-center gap-2">
                      <X className="size-3.5 text-danger-fg" />
                      {a.hardcoded}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex flex-wrap items-center gap-2 text-fg-secondary">
                      <Check className="size-3.5 text-success-fg" />
                      {a.sdk}
                      <PrimitiveChip name={a.primitive} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
