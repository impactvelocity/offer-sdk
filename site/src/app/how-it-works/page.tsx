import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { AgentDemo } from "@/components/demo/agent/agent-demo";
import { DemoPlayground } from "@/components/demo/playground";
import { SectionHeading } from "@/components/section-heading";

const title = "See the React SDK respond to changes in real time";
const description =
  "Switch plans, use up credits or fail a payment on a mock app, then watch an agent save a cancellation and build a checkout per visitor.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/how-it-works" });

export default function DemoPage() {
  return (
    <div className="relative isolate">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-brand-glow" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-medium text-balance sm:text-5xl">
            See the React SDK respond to changes in real time
          </h1>
          <p className="mt-5 text-lg/8 text-pretty text-fg-secondary">
            Switch plans, burn credits or fail a payment in this mock app, and watch paywalls and offers update
            instantly. The log shows every SDK call.
          </p>
          <Link
            href="/docs/sdk"
            className="group focus-ring mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-accent-fg"
          >
            See how the React SDK works in the docs
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
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
