import type { Metadata } from "next";
import { AgentDemo } from "@/components/demo/agent/agent-demo";
import { DemoPlayground } from "@/components/demo/playground";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Try Offer SDK on a mock app: switch plans, use up credits, fail a payment, then watch an agent save a cancellation and build a checkout per visitor.",
};

export default function DemoPage() {
  return (
    <div className="relative isolate">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-brand-glow" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-accent-fg">Demo</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-balance sm:text-5xl">
            See your app react to every plan change
          </h1>
          <p className="mt-4 text-fg-muted">
            Acme Docs is a mock app wired to a simulated Offer SDK. Use the controls to switch plans, burn credits or
            fail a payment, or click around the app yourself. Locked features, paywalls and offers update in real time,
            and the log shows each call the SDK would make. Nothing here touches a real account.
          </p>
        </div>
        <div className="mt-12">
          <DemoPlayground />
        </div>

        <section id="agent" className="mt-28 scroll-mt-20">
          <SectionHeading
            align="left"
            eyebrow="Agentic"
            title="Let the agent pick the offer"
            lead="The same SDK, with an agent choosing what to offer. Pick a customer and set your guardrails, then watch it read the account, decide inside your limits and write the copy. The model is scripted here; the steps match a real run."
          />
          <div className="mt-10">
            <AgentDemo />
          </div>
        </section>
      </div>
    </div>
  );
}
