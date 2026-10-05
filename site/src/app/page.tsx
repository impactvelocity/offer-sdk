import { ArrowRight, Bot, CreditCard, Gauge, KeyRound, Layers, Sparkles } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import heroBg from "@/assets/hero-bg-muted.webp";
import { Eyebrow, IconTile, type BadgeColor } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { CodeBlock } from "@/components/ui/code-block";
import { PlatformPrimitives } from "@/components/platform-primitives";
import { APP_URL } from "@/lib/env";

const features: { icon: ReactNode; color: BadgeColor; title: string; body: string }[] = [
  {
    icon: <Layers />,
    color: "purple",
    title: "Plans & entitlements",
    body: "Model what every plan unlocks once, then check access anywhere with a single call.",
  },
  {
    icon: <Sparkles />,
    color: "pink",
    title: "Offers & incentives",
    body: "Discounts, trials and order bumps you can launch, target and retire without a deploy.",
  },
  {
    icon: <CreditCard />,
    color: "blue",
    title: "PayPal checkout",
    body: "Design one checkout page and sell any offer on it by id. Prices are re-checked on the server.",
  },
  {
    icon: <Gauge />,
    color: "orange",
    title: "Usage limits",
    body: "Meter usage per entitlement and answer over-limit requests with an upgrade offer.",
  },
  {
    icon: <Bot />,
    color: "teal",
    title: "Agent built in",
    body: "Ask the dashboard agent to draft a promo, create a link or explain an account's plan.",
  },
  {
    icon: <KeyRound />,
    color: "green",
    title: "API first",
    body: "Everything in the dashboard is available over a REST API, with webhooks for every change.",
  },
];

const steps = [
  { title: "Define your catalog", body: "Create plans, entitlements and add-ons in the dashboard." },
  { title: "Drop in the SDK", body: "Wrap your app in the provider and read the resolved plan with a hook." },
  { title: "Sell with offers", body: "Point ads and affiliates at offer links that check out through PayPal." },
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
            Plans, entitlements and offers, <span className="text-brand">without the billing code</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-fg-muted">
            Offer SDK gives your product one place to define what each customer gets, and a React SDK to sell it.
            Launch a promo in the dashboard, not in a sprint.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href={`${APP_URL}/sign-up`} className={buttonVariants({ variant: "primary", size: "xl" })}>
              Get started free
              <ArrowRight />
            </a>
            <a href="#developers" className={buttonVariants({ variant: "secondary", size: "xl" })}>
              Read the SDK
            </a>
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="Platform" title="Five primitives, one model" />
        <p className="mx-auto mt-4 max-w-xl text-center text-fg-muted">
          Everything you sell is built from the same five pieces, so pricing changes are data, not deploys.
        </p>
        <PlatformPrimitives className="mt-16" />
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="Features" title="Everything between “free” and “paid”" />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-panel p-6">
              <IconTile color={f.color}>{f.icon}</IconTile>
              <h3 className="mt-5 text-lg font-semibold text-fg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="How it works" title="Live in an afternoon" />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border bg-bg p-6 shadow-xs">
              <span className="font-display text-sm font-semibold text-brand tabular">0{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="developers" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[2fr_3fr]">
          <div>
            <SectionHeading align="left" eyebrow="Developers" title="One checkout page, every offer" />
            <p className="mt-4 text-fg-muted">
              Compose the checkout from SDK components and style it like the rest of your app. Pass a different offer
              id per campaign and the page updates itself.
            </p>
            <a href={`${APP_URL}/sign-up`} className={buttonVariants({ variant: "link", className: "mt-6 text-base" })}>
              Get your API keys <ArrowRight className="size-4" />
            </a>
          </div>
          <CodeBlock title="app/checkout/page.tsx" code={snippet} />
        </div>
      </section>

    </>
  );
}

function SectionHeading({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center" : undefined}>
      <p className="text-sm font-medium text-accent-fg">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold text-balance sm:text-4xl">{title}</h2>
    </div>
  );
}
