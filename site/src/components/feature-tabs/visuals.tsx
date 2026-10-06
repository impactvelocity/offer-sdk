import { Copy, Link as LinkIcon, Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

/*
 * Product mockups for the feature tabs. Static HTML built from the design tokens; children of a
 * `.stagger` container fade up one after another when their tab opens.
 */

const fullPlan = `{
  "plan": "pro",
  "offer": "spring_launch",
  "entitlements": {
    "exports": true,
    "seats": { "limit": 10, "used": 4 },
    "ai_credits": { "limit": 5000, "used": 4120 }
  },
  "incentive": { "percent_off": 20, "cycles_left": 2 }
}`;

export function ApiVisual() {
  return (
    <div className="stagger space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs">
        <span className="rounded bg-tag-green-bg px-1.5 py-0.5 font-medium text-tag-green-fg">GET</span>
        <span className="truncate text-fg-secondary">/apps/app_123/namespaces/acct_42/full-plan</span>
        <span className="ml-auto shrink-0 text-success-fg">200 · 38ms</span>
      </div>
      <CodeBlock code={fullPlan} className="shadow-none" />
      <div className="flex flex-wrap gap-1.5">
        {["Plans", "Entitlements", "Add-ons", "Usage", "Offers", "Webhooks"].map((r) => (
          <span key={r} className="rounded-md border border-border bg-bg px-2 py-1 font-mono text-[11px] text-fg-tertiary">
            /{r.toLowerCase().replace("-", "")}
          </span>
        ))}
      </div>
    </div>
  );
}

const gateCode = `const credits = useEntitlement("ai_credits");

<Gate feature="custom_domains" fallback={<UpgradeOffer />}>
  <DomainSettings />
</Gate>`;

export function SdkVisual() {
  return (
    <div className="stagger space-y-3">
      <CodeBlock title="app/settings.tsx" code={gateCode} className="shadow-none" />
      <Window title="Your app · Settings">
        <Row label="Export to PDF">
          <Badge color="green">Included</Badge>
        </Row>
        <Row label="AI credits">
          <span className="flex w-40 flex-col items-end gap-1.5">
            <span className="text-xs text-fg-tertiary tabular">4,120 / 5,000</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-bg-active">
              <span className="block h-full w-[82%] rounded-full bg-brand" />
            </span>
          </span>
        </Row>
        <Row label="Custom domains" locked>
          <span className="inline-flex h-7 items-center rounded-md bg-brand-vertical px-2.5 text-xs font-medium text-white">
            Unlock with Pro
          </span>
        </Row>
      </Window>
    </div>
  );
}

export function AgentVisual() {
  return (
    <div className="stagger space-y-3">
      <div className="flex items-center gap-2 text-xs text-fg-tertiary">
        <span className="size-1.5 rounded-full bg-danger" />
        <span className="font-mono">acct_42</span> clicked <span className="text-fg">Cancel subscription</span>
        <span className="ml-auto">just now</span>
      </div>
      <div className="flex gap-3">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--tone)_20%,transparent)] text-(--tone)">
          <Sparkles className="size-3.5" />
        </span>
        <p className="rounded-xl rounded-tl-sm border border-border bg-bg px-3.5 py-2.5 text-sm text-fg-secondary">
          Heavy user: 82% of credits used and active 26 of the last 30 days. Best save is 3 months at 40% off plus
          2,000 bonus credits.
        </p>
      </div>
      <div className="ml-10 overflow-hidden rounded-xl border border-border bg-bg">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <p className="text-sm font-medium text-fg">Stay on Pro</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold text-fg tabular">$17.40</span>
              <span className="text-sm text-fg-muted line-through tabular">$29</span>
              <span className="text-xs text-fg-tertiary">/mo for 3 months</span>
            </p>
          </div>
          <Badge color="pink">+2,000 credits</Badge>
        </div>
        <div className="flex items-center gap-3 p-4">
          <span className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-(--paypal) text-sm font-semibold text-(--paypal-fg)">
            Pay with PayPal
          </span>
          <span className="text-xs text-fg-muted">Expires in 48h</span>
        </div>
      </div>
      <div className="ml-10 flex gap-4 text-xs text-fg-tertiary">
        <span>
          Projected LTV <span className="text-success-fg tabular">+$214</span>
        </span>
        <span>Within your discount guardrails</span>
      </div>
    </div>
  );
}

const bundles: { initials: string; color: BadgeColor; name: string; kind: string; bundle: string; deal: string; link: string }[] = [
  {
    initials: "SB",
    color: "pink",
    name: "@sarahbuilds",
    kind: "Influencer",
    bundle: "Pro yearly + Template pack",
    deal: "30% off",
    link: "offer.to/sarah",
  },
  {
    initials: "IH",
    color: "blue",
    name: "Indie Hackers",
    kind: "Affiliate",
    bundle: "Pro monthly + Onboarding call",
    deal: "1st month free",
    link: "offer.to/ih",
  },
  {
    initials: "BF",
    color: "orange",
    name: "Black Friday",
    kind: "Promotion",
    bundle: "Lifetime + every add-on",
    deal: "$199 once",
    link: "offer.to/bf",
  },
];

export function BundlesVisual() {
  return (
    <div className="stagger space-y-3">
      <div className="flex items-center justify-between text-xs text-fg-tertiary">
        <span>
          Checkout page <span className="font-mono text-fg-secondary">/pricing</span>
        </span>
        <span>1 page · 3 bundles · 0 deploys</span>
      </div>
      {bundles.map((b) => (
        <div key={b.link} className="flex items-center gap-3 rounded-xl border border-border bg-bg p-3">
          <Badge color={b.color} className="size-9 justify-center rounded-full px-0 text-xs">
            {b.initials}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm text-fg">
              <span className="truncate font-medium">{b.name}</span>
              <span className="text-xs text-fg-muted">{b.kind}</span>
            </p>
            <p className="truncate text-xs text-fg-tertiary">{b.bundle}</p>
          </div>
          <Badge color={b.color} className="hidden sm:inline-flex">
            {b.deal}
          </Badge>
          <span className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-fg-secondary md:inline-flex">
            <LinkIcon className="size-3 text-fg-icon" />
            {b.link}
            <Copy className="size-3 text-fg-icon" />
          </span>
        </div>
      ))}
      <p className="text-xs text-fg-muted">Edit a bundle in the dashboard and its link updates. No code changes.</p>
    </div>
  );
}

function Window({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      <div className="flex h-9 items-center gap-2 border-b border-border bg-panel px-3 text-xs text-fg-tertiary">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-bg-active" />
          <span className="size-2 rounded-full bg-bg-active" />
          <span className="size-2 rounded-full bg-bg-active" />
        </span>
        <span className="ml-2">{title}</span>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ label, locked, children }: { label: string; locked?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className={cn("flex items-center gap-2 text-sm", locked ? "text-fg-muted" : "text-fg")}>
        {locked ? <Lock className="size-3.5 text-fg-icon" /> : null}
        {label}
      </span>
      {children}
    </div>
  );
}
