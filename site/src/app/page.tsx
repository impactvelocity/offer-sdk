import { ArrowRight } from "lucide-react";
import Image from "next/image";
import heroBg from "@/assets/hero-bg-muted.webp";
import { Eyebrow } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { CodeBlock } from "@/components/ui/code-block";
import { ProductTabs } from "@/components/feature-tabs/product-tabs";
import { PlatformPrimitives } from "@/components/platform-primitives";
import { SectionHeading } from "@/components/section-heading";
import { ProblemsSection } from "@/components/sections/problems";
import { UseCasesSection } from "@/components/sections/use-cases";
import { APP_URL } from "@/lib/env";

const steps = [
  "Set up your plans and entitlements in the dashboard.",
  "Wrap your app in the provider and read what each account can use.",
  "Send buyers to offer links that check out through PayPal.",
];

const snippet = `import { OfferProvider, Offer } from "offer-sdk/checkout";

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
      <section className="relative isolate flex min-h-[clamp(620px,88svh,860px)] items-center overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Image src={heroBg} alt="" fill priority placeholder="blur" sizes="100vw" className="object-cover" />
          {/* Fade the artwork into the page: edges first, then a long fade at the bottom. */}
          <div className="absolute inset-0 bg-[radial-gradient(45%_50%_at_50%_45%,var(--canvas),transparent)] opacity-70" />
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-canvas to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-b from-transparent to-canvas" />
        </div>
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6">
          <Eyebrow lead="New">PayPal checkout for any offer</Eyebrow>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
            Pricing changes shouldn’t need <span className="text-brand">a pull request</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-muted">
            Plans, custom deals, promos and partner bundles live in Offer SDK, not in your code. Your app makes one call
            to see what an account can use, and every offer sells on the same PayPal checkout page.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href={`${APP_URL}/sign-up`} className={buttonVariants({ variant: "primary", size: "xl" })}>
              Get started free
              <ArrowRight />
            </a>
            <a href="#developers" className={buttonVariants({ variant: "secondary", size: "xl" })}>
              See the code
            </a>
          </div>
        </div>
      </section>

      <ProblemsSection />

      <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionHeading title="One answer to “what can this account do?”" />
        <ProductTabs className="mt-12" />
      </section>

      <UseCasesSection />

      <section id="platform" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionHeading
          title="Everything you sell is built from five pieces"
          lead="Change any of them in the dashboard and your app picks up the change without a deploy."
        />
        <PlatformPrimitives className="mt-16" />
      </section>

      <section id="developers" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[2fr_3fr]">
          <div>
            <SectionHeading align="left" title="One checkout page for every offer" />
            <p className="mt-4 text-fg-muted">
              Build the checkout from SDK components and style it like the rest of your app. Each ad or partner link
              passes its own offer id, and the server re-prices every selection before it reaches PayPal.
            </p>
            <ol className="mt-8 space-y-3">
              {steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-fg-secondary">
                  <span className="font-display font-semibold text-brand tabular">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <a href={`${APP_URL}/sign-up`} className={buttonVariants({ variant: "link", className: "mt-8 text-base" })}>
              Get your API keys <ArrowRight className="size-4" />
            </a>
          </div>
          <CodeBlock title="app/checkout/page.tsx" code={snippet} />
        </div>
      </section>
    </>
  );
}
