import type { Metadata } from "next";
import { AgentDemo } from "@/components/demo/agent/agent-demo";
import { DemoPlayground } from "@/components/demo/playground";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Try Offer SDK on a mock app: switch plans, use up credits, fail a payment, then watch an agent save a cancellation and build a checkout per visitor.",
};

export default function DemoPage() {
  return (
    <div className="relative isolate">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-brand-glow" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-medium text-balance sm:text-5xl">
            Watch your app react to plan changes
          </h1>
          <p className="mt-4 text-fg-muted">
            Acme Docs is a mock app on a simulated Offer SDK. Switch plans, burn credits or fail a payment, and watch
            features, paywalls and offers update live. The log shows every SDK call. No real accounts are touched.
          </p>
        </div>
        <div className="mt-12">
          <DemoPlayground />
        </div>

        <section id="agent" className="mt-28 scroll-mt-20">
          <SectionHeading
            title="Let the agent pick the offer"
            lead="Same SDK. You set the limits, the agent works inside them."
          />
          <p className="mt-6 max-w-2xl text-fg-muted">
            Pick a customer and set guardrails. The agent reads the account, chooses an offer and writes the copy. The
            model is scripted here, but the steps match a real run.
          </p>
          <div className="mt-10">
            <AgentDemo />
          </div>
        </section>
      </div>
    </div>
  );
}
