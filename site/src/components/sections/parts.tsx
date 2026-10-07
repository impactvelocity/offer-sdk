import type { ComponentType } from "react";
import type { MarkerTone } from "@/components/diagrams/kit";
import { AdminDiagram, ApiDiagram, SdkDiagram } from "@/components/diagrams/parts";
import { DiagramReveal } from "@/components/diagrams/reveal";
import { SectionHeading } from "@/components/section-heading";
import { cardStyle } from "./use-cases";

const parts: { name: string; title: string; body: string; tone: MarkerTone; Diagram: ComponentType }[] = [
  {
    name: "API",
    title: "The entitlement and offer engine.",
    body: "One call returns everything an account can use, with plans, add-ons, incentives and offers merged into features and limits. Checkout runs through PayPal.",
    tone: "green",
    Diagram: ApiDiagram,
  },
  {
    name: "Admin App",
    title: "Control, analytics and insights.",
    body: "Change plans, limits and offers without a deploy. See usage per account and feature, run cancel flows, and approve what the agent proposes.",
    tone: "violet",
    Diagram: AdminDiagram,
  },
  {
    name: "React SDK",
    title: "Integrate and lock down your app.",
    body: "Wrap your app in the provider and gate features where they live. Paywalls, checkout and cancel flows read straight from the API, so access matches what each account paid for.",
    tone: "blue",
    Diagram: SdkDiagram,
  },
];

/** The three parts you deploy, one card each with its own line diagram. */
export function PartsSection() {
  return (
    <section id="parts" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 sm:pb-32">
      <SectionHeading
        title="Own the code that decides who gets what."
        lead="One click puts it on your Render account."
        className="text-center [&_h2]:mx-auto"
      />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {parts.map(({ name, title, body, tone, Diagram }) => (
          <article
            key={name}
            style={cardStyle(tone)}
            className="diagram-cell group flex flex-col rounded-2xl border border-border bg-panel p-6 shadow-lg"
          >
            <DiagramReveal className="mx-auto mb-6 w-full max-w-[260px]">
              <Diagram />
            </DiagramReveal>
            <h3 className="text-xl">
              <span className="font-medium text-fg">{name}.</span> <span className="text-fg-muted">{title}</span>
            </h3>
            <p className="mt-3 text-sm/6 text-fg-secondary">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
