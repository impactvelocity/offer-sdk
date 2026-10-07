import { ArrowDown, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import heroBg from "@/assets/hero-bg.webp";
import { buttonVariants } from "@/components/ui/button-variants";
import { CodeBlock } from "@/components/ui/code-block";
import { CreatorCard } from "@/components/creator-card";
import { DashboardSlider } from "@/components/dashboard-slider";
import { ProductTabs } from "@/components/feature-tabs/product-tabs";
import { PlatformPrimitives } from "@/components/platform-primitives";
import { SectionHeading } from "@/components/section-heading";
import { PartsSection } from "@/components/sections/parts";
import { ProblemsSection } from "@/components/sections/problems";
import { UseCasesSection } from "@/components/sections/use-cases";
import { WalkthroughVideo } from "@/components/walkthrough-video";
import { APP_URL, DEVPOST_URL, RENDER_DEPLOY_URL } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";

// The hero's headline and lead.
export const metadata: Metadata = pageMetadata({
  title: "The Agentic Access & Offer SDK for your app",
  description:
    "Self-host your own entitlements, access and offers that secure your app and give you the freedom to experiment and grow your revenue.",
  path: "/",
  absoluteTitle: true,
});

const steps = [
  "Set up your plans and entitlements in the dashboard.",
  "Wrap your app in the provider and read what each account can use.",
  "Send buyers to offer links that check out through PayPal.",
];

// Text links under the hero CTAs; they smooth-scroll to the sections below.
const jumpLinks = [
  { href: "#product", label: "Product" },
  { href: "#dashboard", label: "Dashboard" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#platform", label: "Platform" },
];

const snippet =`import { OfferProvider, Offer } from "offer-sdk/checkout";

export default function Checkout({ searchParams }) {
  return (
    <OfferProvider appId="app_123" offerId={searchParams.offer}>
      <Offer.Headline />
      <Offer.IntervalToggle />
      <Offer.Plans>{(plan) => <Offer.Plan plan={plan} />}</Offer.Plans>
      <Offer.Bumps>{(bump) => <Offer.Bump bump={bump} />}</Offer.Bumps>
      <Offer.Summary />
      <Offer.Checkout />
    </OfferProvider>
  );
}`;

export default function LandingPage() {
  return (
    <>
      <section className="relative isolate flex min-h-[clamp(560px,72svh,720px)] items-end overflow-hidden">
        {/* The artwork keeps the hero's original height; the walkthrough video sits below it. */}
        <div className="absolute inset-x-0 top-0 -z-10 h-[clamp(560px,72svh,720px)]" aria-hidden>
          <Image src={heroBg} alt="" fill priority placeholder="blur" sizes="100vw" className="object-cover" />
          {/* Fade the artwork into the page: top edge, a long fade at the bottom, and a wash behind the copy. */}
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-canvas to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-b from-transparent via-canvas/70 to-canvas" />
          <div className="absolute inset-y-0 left-0 w-3/4 bg-linear-to-r from-canvas/70 to-transparent" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-20 sm:px-6 sm:pb-24">
          <a
            href={DEVPOST_URL}
            target="_blank"
            rel="noreferrer"
            className="focus-ring mb-6 inline-flex rounded-full px-3 py-1 text-sm text-fg-secondary ring-1 ring-inset ring-border-strong transition-colors hover:bg-bg-hover hover:text-fg"
          >
            Built for the PayPal AI Hackathon
          </a>
          <h1 className="max-w-4xl font-display text-4xl font-medium tracking-wider text-balance sm:text-5xl lg:text-6xl">
            The Agentic Access &amp; Offer SDK for your app
          </h1>
          <p className="mt-6 max-w-2xl text-xl/9 text-pretty text-fg">
            Self-host your own entitlements, access and offers that secure your app and give you the freedom to
            experiment and grow your revenue.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href={RENDER_DEPLOY_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "primary", size: "xl" })}
            >
              Deploy on Render
              <ArrowRight />
            </a>
            <a href={`${APP_URL}/demo-account`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "xl" })}>
              Try the Demo Account
            </a>
          </div>
          <nav aria-label="On this page" className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {jumpLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group focus-ring inline-flex items-center gap-1 rounded-sm text-fg-secondary transition-colors hover:text-fg"
              >
                <span className="jump-link">{link.label}</span>
                <ArrowDown className="jump-arrow size-3.5" aria-hidden />
              </a>
            ))}
          </nav>
          <CreatorCard className="mt-10" />
          <WalkthroughVideo className="mt-16 sm:mt-20" />
        </div>
      </section>

      <PartsSection />

      <ProblemsSection />

      <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          title="An agent that fights churn for you."
          lead="It sees what each account uses and makes the offer that keeps them, right at the cancel button."
        />
        <ProductTabs className="mt-16" />
      </section>

      <section id="dashboard" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          title="The admin app you host."
          lead="Manage your plans, offers and accounts in one place."
        />
        <DashboardSlider className="mt-16" />
      </section>

      <UseCasesSection />

      <section id="platform" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          title="Everything you sell, built from five pieces."
          lead="Change one in the dashboard, no deploy needed."
        />
        <PlatformPrimitives className="mt-16" />
      </section>

      <section id="developers" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          title="One checkout page for every offer."
          lead="Built from SDK components, styled like your app."
        />
        <div className="mt-16 grid items-start gap-12 lg:grid-cols-[2fr_3fr] lg:gap-12">
          <div>
            <p className="text-base/7 text-pretty text-fg-secondary">
              Every link carries its own offer, and the server re-checks each price before it reaches PayPal.
            </p>
            <ol className="mt-8 divide-y divide-border border-y border-border">
              {steps.map((step) => (
                <li key={step} className="py-4 text-base/7 text-pretty text-fg-secondary">
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <CodeBlock title="app/checkout/page.tsx" code={snippet} />
        </div>
      </section>
    </>
  );
}
