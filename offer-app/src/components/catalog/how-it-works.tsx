"use client";

import {
  ArrowRight,
  BadgeCheck,
  Gift,
  HelpCircle,
  KeyRound,
  Layers,
  Puzzle,
  Sparkles,
  ToggleRight,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { RecordIcon } from "@/components/catalog/record";
import { Button } from "@/components/ui/button";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type HowItWorksTopic = "plans" | "entitlements" | "addons" | "incentives";

interface Guide {
  label: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "purple" | "pink";
  title: string;
  tagline: string;
  hero: () => ReactNode;
  steps: { title: string; body: string }[];
  uses: { icon: LucideIcon; title: string; body: string }[];
  tip: string;
}

const GUIDES: Record<HowItWorksTopic, Guide> = {
  plans: {
    label: "How Plans Work",
    icon: Layers,
    tone: "blue",
    title: "Plans",
    tagline:
      "A plan is what a customer buys. It bundles entitlements and limits, carries the price you show on your pricing page, and every account sits on exactly one.",
    hero: PlansHero,
    steps: [
      {
        title: "Pick what's included",
        body: "Attach entitlements with a limit (10 projects, 5,000 AI credits) or switch features on (SSO, PDF export).",
      },
      {
        title: "Set the price",
        body: "Add a pricing card with monthly, yearly or one-time pricing and the benefits you want to list. Mark one as featured.",
      },
      {
        title: "Put accounts on it",
        body: "When someone signs up or upgrades, assign the plan. Your app checks access against it, so there's nothing to hard-code.",
      },
    ],
    uses: [
      {
        icon: TrendingUp,
        title: "Good, better, best tiers",
        body: "Free, Pro and Business with rising limits, so customers upgrade when they hit a ceiling instead of churning.",
      },
      {
        icon: Sparkles,
        title: "Change pricing without a deploy",
        body: "Raise a limit or add a feature to Pro here and every Pro account gets it on the next check.",
      },
      {
        icon: BadgeCheck,
        title: "Grandfather early customers",
        body: "Duplicate a plan as “Pro (2025)” to keep legacy pricing for existing accounts while new signups get the new one.",
      },
    ],
    tip: "Start with a free plan. Every new account needs somewhere to land.",
  },
  entitlements: {
    label: "How Entitlements Work",
    icon: KeyRound,
    tone: "green",
    title: "Entitlements",
    tagline:
      "Entitlements are the features and limits you gate. Define each one once, then decide per plan how much of it a customer gets.",
    hero: EntitlementsHero,
    steps: [
      {
        title: "Name what you gate",
        body: "Usage entitlements count something: projects, seats, AI credits. Boolean entitlements switch a feature on or off: SSO, exports, API access.",
      },
      {
        title: "Give it a limit on each plan",
        body: "The same entitlement can be 3 on Free, 50 on Pro and unlimited on Business.",
      },
      {
        title: "Check it in your app",
        body: "Before the action happens, ask Offer whether the account has access. It answers from the account's plan plus any incentive.",
      },
    ],
    uses: [
      {
        icon: ToggleRight,
        title: "Gate premium features",
        body: "Hide or lock the export button, the API key page or SSO setup until the account's plan includes it.",
      },
      {
        icon: TrendingUp,
        title: "Meter usage that costs you money",
        body: "Cap AI credits, storage or sends per plan so heavy users move up a tier instead of eating your margin.",
      },
      {
        icon: Sparkles,
        title: "Show upgrade prompts at the right moment",
        body: "When a check comes back over the limit, show the plan that unlocks more, right where the customer hit the wall.",
      },
    ],
    tip: "Gate the feature, not the plan name. Checking “export_pdf” keeps working when you rename or re-tier plans.",
  },
  addons: {
    label: "How Add-ons Work",
    icon: Puzzle,
    tone: "purple",
    title: "Add-ons",
    tagline:
      "Add-ons are optional extras that sit on top of a plan, like an extra storage pack or white-label branding. Customers get them without changing tiers.",
    hero: AddonsHero,
    steps: [
      {
        title: "Create the add-on",
        body: "Give it a name and an ID your app will recognise, such as “white_label” or “storage_100gb”.",
      },
      {
        title: "Attach it to plans or incentives",
        body: "Include it in a plan by default, or grant it to specific accounts through an incentive.",
      },
      {
        title: "Read it in your app",
        body: "Accounts that have the add-on receive it in addons, so your app can switch on the extra.",
      },
    ],
    uses: [
      {
        icon: TrendingUp,
        title: "Expansion revenue",
        body: "Sell extra seats, storage or priority support to customers who love their plan but need a bit more.",
      },
      {
        icon: BadgeCheck,
        title: "Enterprise extras",
        body: "Keep white-label, audit logs or a dedicated region as add-ons so you can say yes to big deals without inventing a new plan.",
      },
      {
        icon: Layers,
        title: "Keep your plan list short",
        body: "Instead of “Pro + Storage” and “Pro + Branding” plans, keep one Pro plan and let add-ons cover the variations.",
      },
    ],
    tip: "If more than half your customers buy an add-on, consider folding it into a plan.",
  },
  incentives: {
    label: "How Incentives Work",
    icon: Gift,
    tone: "pink",
    title: "Incentives",
    tagline:
      "Incentives change what a customer gets without touching their plan. Raise a limit, unlock a feature or grant an add-on, then apply it to any account.",
    hero: IncentivesHero,
    steps: [
      {
        title: "Describe the offer",
        body: "Pick the entitlements and add-ons it overrides, such as “Projects: 25” or “SSO: on”.",
      },
      {
        title: "Apply it to accounts",
        body: "Attach the incentive to one account or many. Their plan stays the same.",
      },
      {
        title: "Access updates instantly",
        body: "Checks combine the plan with the incentive, so the customer sees the perk on the next request. Remove it to roll back.",
      },
    ],
    uses: [
      {
        icon: Sparkles,
        title: "Launch promos and trials",
        body: "Give new signups Pro limits for their first month to show what upgrading feels like.",
      },
      {
        icon: Gift,
        title: "Partner and community deals",
        body: "Offer a startup program, agency partners or a newsletter audience extra credits without a custom plan.",
      },
      {
        icon: TrendingUp,
        title: "Win-back and save offers",
        body: "When someone tries to cancel, raise a limit or unlock a feature to keep them, and track who took it.",
      },
    ],
    tip: "Name incentives after the campaign (“Launch week 2026”) so you can see later which deals kept customers.",
  },
};

/** "How Plans Work" style header button that opens the explainer drawer. */
export function HowItWorksButton({ topic }: { topic: HowItWorksTopic }) {
  const [open, setOpen] = useState(false);
  const guide = GUIDES[topic];
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <HelpCircle />
        <span className="hidden sm:inline">{guide.label}</span>
      </Button>
      <HowItWorksSheet topic={topic} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function HowItWorksSheet({
  topic,
  open,
  onOpenChange,
}: {
  topic: HowItWorksTopic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const guide = GUIDES[topic];
  const Icon = guide.icon;
  const Hero = guide.hero;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
          {/* Hero: a mock of the concept in the product, on a soft brand wash. */}
          <div className="relative shrink-0 overflow-hidden border-b border-border bg-bg-subtle sm:rounded-t-xl">
            <div aria-hidden className="absolute inset-0 bg-brand-glow" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-60 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
            />
            <SheetCloseButton className="absolute right-3 top-3 z-10 bg-bg/70 backdrop-blur" />
            <div className="relative flex h-60 items-center justify-center px-8">
              <Hero />
            </div>
          </div>

          <div className="flex flex-col gap-8 px-6 pb-8 pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <RecordIcon size="sm" tone={guide.tone}>
                  <Icon />
                </RecordIcon>
                <span className="text-xs font-medium uppercase tracking-wider text-fg-icon">How it works</span>
              </div>
              <SheetTitle className="font-display text-2xl font-semibold text-fg">{guide.title}</SheetTitle>
              <SheetDescription className="text-sm leading-relaxed text-fg-tertiary">{guide.tagline}</SheetDescription>
            </div>

            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-fg">The Basics</h3>
              <ol className="flex flex-col">
                {guide.steps.map((step, i) => (
                  <li key={step.title} className="relative flex gap-3.5 pb-5 last:pb-0">
                    {i < guide.steps.length - 1 ? (
                      <span aria-hidden className="absolute left-3 top-7 bottom-1 w-px bg-border" />
                    ) : null}
                    <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-fg">
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <span className="text-sm font-medium text-fg">{step.title}</span>
                      <span className="text-sm leading-relaxed text-fg-tertiary">{step.body}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-fg">How You Can Use It</h3>
              <div className="flex flex-col gap-2">
                {guide.uses.map((use) => {
                  const UseIcon = use.icon;
                  return (
                    <div key={use.title} className="flex gap-3 rounded-lg border border-border bg-bg p-3.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-bg-muted text-fg-icon [&_svg]:size-4">
                        <UseIcon />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-fg">{use.title}</span>
                        <span className="text-sm leading-relaxed text-fg-tertiary">{use.body}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="flex gap-2.5 rounded-lg bg-accent-subtle px-3.5 py-3 text-sm text-accent-fg">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              <span className="leading-relaxed">{guide.tip}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- Mock heroes ---------- */

function MockCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-bg-elevated p-3 shadow-md", className)}>{children}</div>
  );
}

function Line({ w, className }: { w: string; className?: string }) {
  return <span className={cn("block h-1.5 rounded-full bg-bg-active", className)} style={{ width: w }} />;
}

function PlansHero() {
  const tiers = [
    { name: "Free", price: "$0", lines: ["70%", "55%"] },
    { name: "Pro", price: "$29", lines: ["80%", "65%", "72%"], featured: true },
    { name: "Business", price: "$99", lines: ["75%", "60%", "70%", "50%"] },
  ];
  return (
    <div className="flex items-end gap-3">
      {tiers.map((t) => (
        <MockCard
          key={t.name}
          className={cn(
            "flex w-[120px] flex-col gap-2.5",
            t.featured && "-translate-y-3 ring-2 ring-[var(--accent)] ring-offset-0",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg">{t.name}</span>
            {t.featured ? (
              <span className="rounded-full bg-accent-subtle px-1.5 py-px text-[9px] font-semibold text-accent-fg">
                Popular
              </span>
            ) : null}
          </div>
          <span className="font-display text-lg font-semibold leading-none text-fg">
            {t.price}
            <span className="text-[10px] font-normal text-fg-icon">/mo</span>
          </span>
          <div className="flex flex-col gap-1.5">
            {t.lines.map((w, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-success" />
                <Line w={w} />
              </div>
            ))}
          </div>
          <span
            className={cn(
              "mt-1 h-5 rounded-md",
              t.featured ? "bg-brand-vertical" : "bg-bg-muted ring-1 ring-inset ring-border",
            )}
          />
        </MockCard>
      ))}
    </div>
  );
}

function EntitlementsHero() {
  return (
    <MockCard className="flex w-[300px] flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-3.5 text-fg-icon" />
        <span className="text-xs font-semibold text-fg">Pro plan access</span>
      </div>
      {[
        { name: "AI credits", used: 3200, max: 5000 },
        { name: "Projects", used: 9, max: 10 },
      ].map((u) => {
        const pct = (u.used / u.max) * 100;
        return (
          <div key={u.name} className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-fg-secondary">{u.name}</span>
              <span className="tabular text-fg-icon">
                {u.used.toLocaleString()} / {u.max.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-muted">
              <div
                className={cn("h-full rounded-full", pct > 85 ? "bg-warning" : "bg-brand")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        {[
          { name: "SSO", on: true },
          { name: "PDF export", on: true },
          { name: "Audit log", on: false },
        ].map((f) => (
          <div key={f.name} className="flex items-center justify-between text-[11px]">
            <span className="text-fg-secondary">{f.name}</span>
            <span
              className={cn(
                "flex h-3.5 w-6 items-center rounded-full p-0.5",
                f.on ? "justify-end bg-accent" : "justify-start bg-bg-active",
              )}
            >
              <span className="size-2.5 rounded-full bg-white shadow-xs" />
            </span>
          </div>
        ))}
      </div>
    </MockCard>
  );
}

function AddonsHero() {
  return (
    <div className="flex items-center gap-4">
      <MockCard className="flex w-[140px] flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-tag-blue-fg" />
          <span className="text-xs font-semibold text-fg">Pro</span>
        </div>
        <Line w="80%" />
        <Line w="60%" />
        <Line w="70%" />
        <div className="mt-1 flex flex-col gap-1.5 border-t border-dashed border-border-strong pt-2.5">
          {["Extra storage", "White-label"].map((a) => (
            <span
              key={a}
              className="flex items-center gap-1 rounded-md bg-tag-purple-bg px-1.5 py-1 text-[10px] font-medium text-tag-purple-fg"
            >
              <Puzzle className="size-3" />
              {a}
            </span>
          ))}
        </div>
      </MockCard>
      <div className="flex flex-col gap-2">
        {[
          { name: "Extra storage", price: "+$10/mo", added: true },
          { name: "White-label", price: "+$49/mo", added: true },
          { name: "Priority support", price: "+$99/mo", added: false },
        ].map((a) => (
          <MockCard key={a.name} className={cn("flex w-[150px] items-center gap-2 p-2", !a.added && "opacity-60")}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-tag-purple-bg text-tag-purple-fg">
              <Puzzle className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] font-medium text-fg">{a.name}</span>
              <span className="text-[10px] text-fg-icon">{a.price}</span>
            </div>
            {a.added ? <BadgeCheck className="ml-auto size-3.5 shrink-0 text-success" /> : null}
          </MockCard>
        ))}
      </div>
    </div>
  );
}

function IncentivesHero() {
  return (
    <div className="flex flex-col items-center gap-3">
      <MockCard className="flex w-[300px] items-center gap-2.5 p-2.5">
        <span className="flex size-7 items-center justify-center rounded-full bg-tag-orange-bg text-[11px] font-semibold text-tag-orange-fg">
          A
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-medium text-fg">Acme Inc.</span>
          <span className="text-[10px] text-fg-icon">acct_8f2k…</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="rounded-md bg-tag-blue-bg px-1.5 py-0.5 text-[10px] font-medium text-tag-blue-fg">Pro</span>
          <span className="flex items-center gap-1 rounded-md bg-tag-pink-bg px-1.5 py-0.5 text-[10px] font-medium text-tag-pink-fg">
            <Gift className="size-3" />
            Launch promo
          </span>
        </div>
      </MockCard>
      <MockCard className="flex w-[300px] flex-col gap-2 p-3">
        {[
          { name: "Projects", from: "10", to: "25" },
          { name: "AI credits", from: "5,000", to: "Unlimited" },
          { name: "SSO", from: "Off", to: "On" },
        ].map((o) => (
          <div key={o.name} className="flex items-center text-[11px]">
            <span className="text-fg-secondary">{o.name}</span>
            <span className="ml-auto text-fg-icon line-through">{o.from}</span>
            <ArrowRight className="mx-1.5 size-3 text-fg-icon" />
            <span className="font-semibold text-tag-pink-fg">{o.to}</span>
          </div>
        ))}
      </MockCard>
    </div>
  );
}
