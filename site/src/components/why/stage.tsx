import { Check, PenLine, Sparkles, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { PrimitiveChip, type Primitive } from "@/components/sections/primitive-chip";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { highlight } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

/*
 * The pinned "stage" for the story page: one scene per chapter. Steps 2–7 share the code scene so
 * billing.ts grows line by line instead of remounting; steps 8–9 share the Offer SDK scene.
 *
 *   0 idea · 1 build · 2 launch · 3 trial · 4 credits · 5 feature · 6 influencer · 7 pile-up · 8 sdk · 9 insights
 */
export const STEPS = {
  idea: 0,
  build: 1,
  launch: 2,
  trial: 3,
  credits: 4,
  feature: 5,
  influencer: 6,
  pileup: 7,
  sdk: 8,
  insights: 9,
} as const;

export function Stage({ step }: { step: number }) {
  const scene = step <= STEPS.build ? `s${step}` : step <= STEPS.pileup ? "code" : "sdk";
  return (
    <div className="flex w-full flex-col justify-center lg:min-h-[560px]">
      <div key={scene} className="feature-in">
        {step === STEPS.idea && <IdeaScene />}
        {step === STEPS.build && <BuildScene />}
        {scene === "code" && <CodeScene step={step} />}
        {scene === "sdk" && <SdkScene step={step} />}
      </div>
    </div>
  );
}

/* ── 0 · The idea ─────────────────────────────────────────────────────────── */

function IdeaScene() {
  return (
    <div className="stagger relative mx-auto max-w-md rotate-[-1.5deg] rounded-2xl border border-border bg-bg p-7 shadow-soft">
      <p className="flex items-center gap-2 text-xs text-fg-tertiary">
        <PenLine className="size-3.5" /> notes.md · 1:14 AM
      </p>
      <p className="mt-4 font-display text-4xl font-semibold">YourApp.ai</p>
      <p className="mt-1 text-fg-muted">AI first drafts for busy founders</p>
      <ul className="mt-5 space-y-2 text-sm text-fg-secondary">
        {["Paste rough notes, get a clean draft", "Rewrite it in your own voice", "Export anywhere"].map((t) => (
          <li key={t} className="flex gap-2">
            <span className="text-fg-icon">–</span>
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <Badge color="green" icon={<Check />}>
          yourapp.ai bought
        </Badge>
        <Badge color="gray">pricing: figure out later</Badge>
      </div>
    </div>
  );
}

/* ── 1 · You build it ─────────────────────────────────────────────────────── */

const features = ["Editor", "AI rewrites", "Exports", "Templates", "Team seats"];

function BuildScene() {
  return (
    <Window title="YourApp.ai · localhost:3000">
      <div className="grid grid-cols-[140px_1fr]">
        <div className="space-y-1 border-r border-border p-3 text-xs text-fg-tertiary">
          {["Drafts", "Templates", "Team", "Settings"].map((n, i) => (
            <div key={n} className={cn("rounded-md px-2 py-1.5", i === 0 && "bg-bg-hover text-fg")}>
              {n}
            </div>
          ))}
        </div>
        <div className="stagger space-y-2 p-4">
          {features.map((f) => (
            <div key={f} className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm">
              {f}
              <Badge color="green" icon={<Check />}>
                Shipped
              </Badge>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border-strong px-3 py-2 text-sm text-fg-muted">
            Pricing and plans
            <span className="text-xs">later</span>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* ── 2–7 · billing.ts grows ───────────────────────────────────────────────── */

type Line = { at: number; text: string; note?: number };

const lines: Line[] = [
  { at: STEPS.launch, text: "const PLANS = {" },
  { at: STEPS.launch, text: "  starter: { credits: 200, exports: false }," },
  { at: STEPS.launch, text: "  pro:     { credits: 2000, exports: true }," },
  { at: STEPS.launch, text: "  team:    { credits: 10000, exports: true, seats: 10 }," },
  { at: STEPS.launch, text: "};" },
  { at: STEPS.launch, text: "" },
  { at: STEPS.launch, text: "const access = { ...PLANS[user.plan] };" },
  { at: STEPS.trial, text: 'if (user.email === "maya@studio.co") trialDays = 30;', note: 1 },
  { at: STEPS.credits, text: 'if (user.id === "acct_88") access.credits += 500;', note: 2 },
  { at: STEPS.feature, text: 'if (user.plan === "starter" && EXPORTS_ADDON.has(user.id)) {', note: 3 },
  { at: STEPS.feature, text: "  access.exports = true;" },
  { at: STEPS.feature, text: "}" },
  { at: STEPS.influencer, text: 'if (signup.ref === "sarah" && Date.now() < SARAH_ENDS) {', note: 4 },
  { at: STEPS.influencer, text: "  access.credits += 50;" },
  { at: STEPS.influencer, text: "}" },
];

const notes: Record<number, { label: string; who: string }> = {
  1: { label: "Trial override", who: "Maya" },
  2: { label: "Credit bump", who: "Ben" },
  3: { label: "Exports on Starter", who: "Acme Studio" },
  4: { label: "Influencer deal", who: "@sarahbuilds" },
};

export const requests: Record<number, { who: string; initials: string; color: BadgeColor; quote: string }> = {
  [STEPS.trial]: {
    who: "Maya · Starter trial",
    initials: "MK",
    color: "pink",
    quote: "Can I get 30 days instead of 14? Half my team is out this week.",
  },
  [STEPS.credits]: {
    who: "Ben · Starter",
    initials: "BL",
    color: "blue",
    quote: "I don't need Pro. I just need more credits this month.",
  },
  [STEPS.feature]: {
    who: "Acme Studio · Starter",
    initials: "AS",
    color: "orange",
    quote: "Could we get exports on Starter? We'd happily pay extra.",
  },
  [STEPS.influencer]: {
    who: "@sarahbuilds · 80k followers",
    initials: "SB",
    color: "brand",
    quote: "Can my audience get 50 more credits than usual? My video goes live Friday.",
  },
};

function CodeScene({ step }: { step: number }) {
  const shown = lines.filter((l) => l.at <= step);
  const pileup = step >= STEPS.pileup;
  const hacks = shown.filter((l) => l.note).length;
  const request = requests[step];

  return (
    <div className="space-y-3">
      <div key={step} className="feature-in">
        {step === STEPS.launch && <Pricing />}
        {request && <Request {...request} />}
        {pileup && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["4", "one-off checks"],
              ["4", "deploys"],
              ["0", "visibility"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-xl border border-danger/30 bg-danger-subtle/50 px-2 py-3">
                <p className="font-display text-2xl font-semibold text-danger-fg tabular">{n}</p>
                <p className="text-xs text-fg-muted">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Window
        title="billing.ts"
        aside={
          hacks > 0 ? (
            <Badge color={pileup ? "red" : "yellow"} icon={<TriangleAlert />}>
              {hacks} special {hacks === 1 ? "case" : "cases"}
            </Badge>
          ) : (
            <Badge color="green">clean</Badge>
          )
        }
        className={cn(pileup && "border-danger/40")}
      >
        <div className="overflow-x-auto py-3 font-mono text-[12px] leading-[22px]">
          {shown.map((l, i) => {
            const hack = l.at > STEPS.launch;
            const fresh = l.at === step && step > STEPS.launch && !pileup;
            return (
              <div
                key={i}
                className={cn(
                  "flex min-w-max border-l-2 border-transparent pr-4",
                  hack && (pileup ? "border-danger bg-danger-subtle/70" : "bg-warning-subtle/50"),
                  fresh && "story-line-new border-warning",
                )}
              >
                <span className="w-9 shrink-0 pr-3 text-right text-fg-placeholder select-none">{i + 1}</span>
                <span className="flex w-5 shrink-0 items-center">
                  {l.note ? <Note n={l.note} danger={pileup} /> : null}
                </span>
                <code className="whitespace-pre text-fg-secondary">{highlight(l.text)}</code>
              </div>
            );
          })}
        </div>
        {hacks > 0 ? (
          <div className="grid gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-xs sm:grid-cols-2">
            {Object.entries(notes)
              .filter(([n]) => Number(n) <= hacks)
              .map(([n, note]) => (
                <span key={n} className="flex items-center gap-2 text-fg-secondary">
                  <Note n={Number(n)} danger={pileup} />
                  {note.label}
                  <span className="text-fg-muted">· for {note.who}</span>
                </span>
              ))}
          </div>
        ) : null}
      </Window>
    </div>
  );
}

function Pricing() {
  const plans = [
    { name: "Starter", price: "$9", lines: ["200 credits"] },
    { name: "Pro", price: "$29", lines: ["2,000 credits", "Exports"] },
    { name: "Team", price: "$79", lines: ["10,000 credits", "10 seats"] },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {plans.map((p, i) => (
        <div
          key={p.name}
          className={cn("rounded-xl border bg-bg p-3", i === 1 ? "border-accent/50" : "border-border")}
        >
          <p className="text-xs text-fg-tertiary">{p.name}</p>
          <p className="font-display text-xl font-semibold tabular">
            {p.price}
            <span className="text-xs font-normal text-fg-muted">/mo</span>
          </p>
          {p.lines.map((l) => (
            <p key={l} className="text-xs text-fg-muted">
              {l}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Request({ who, initials, color, quote }: { who: string; initials: string; color: BadgeColor; quote: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-bg p-3.5">
      <Badge color={color} className="size-8 shrink-0 justify-center rounded-full px-0 text-xs">
        {initials}
      </Badge>
      <div className="min-w-0">
        <p className="text-xs text-fg-tertiary">{who}</p>
        <p className="mt-0.5 text-sm text-fg">“{quote}”</p>
      </div>
    </div>
  );
}

function Note({ n, danger }: { n: number; danger?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full font-sans text-[10px] font-semibold text-canvas",
        danger ? "bg-danger" : "bg-warning",
      )}
    >
      {n}
    </span>
  );
}

/* ── 8–9 · The Offer SDK path ─────────────────────────────────────────────── */

const deals: { who: string; ask: string; primitive: Primitive; value: string }[] = [
  { who: "Maya", ask: "Longer trial", primitive: "Incentives", value: "Trial · 30 days" },
  { who: "Ben", ask: "More credits", primitive: "Add-ons", value: "Credit pack · +500" },
  { who: "Acme Studio", ask: "Exports on Starter", primitive: "Entitlements", value: "exports: on" },
  { who: "@sarahbuilds", ask: "Audience bonus", primitive: "Offers", value: "offer.to/sarah · +50" },
];

const usage = [
  { feature: "AI rewrites", pct: 91 },
  { feature: "Exports", pct: 38 },
  { feature: "Templates", pct: 12 },
];

function SdkScene({ step }: { step: number }) {
  return (
    <div className="space-y-3">
      <Window title="billing.ts" aside={<Badge color="green">3 lines, for good</Badge>}>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-[22px] text-fg-secondary">
          <code>
            {highlight(`const credits = useEntitlement("ai_credits");
const exports = useEntitlement("exports");
// every deal below lives in Offer SDK`)}
          </code>
        </pre>
      </Window>

      <Window
        title="Offer SDK · YourApp.ai"
        aside={
          <span className="flex items-center gap-1.5 text-xs text-success-fg">
            <Sparkles className="size-3.5" /> 0 deploys
          </span>
        }
      >
        <div className="stagger divide-y divide-border">
          {deals.map((d) => (
            <div key={d.who} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-fg">{d.ask}</p>
                <p className="truncate text-xs text-fg-muted">for {d.who}</p>
              </div>
              <PrimitiveChip name={d.primitive} />
              <span className="hidden w-36 truncate font-mono text-[11px] text-fg-secondary sm:block">{d.value}</span>
              <Badge color="green">Live</Badge>
            </div>
          ))}
        </div>
      </Window>

      {step >= STEPS.insights ? (
        <div className="feature-in">
          <Window title="Usage · last 30 days" aside={<span className="text-xs text-fg-muted">by feature</span>}>
            <div className="space-y-3 px-4 py-3">
              {usage.map((u) => (
                <div key={u.feature} className="grid grid-cols-[96px_1fr_40px] items-center gap-3 text-xs">
                  <span className="text-fg-secondary">{u.feature}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-bg-active">
                    <span className="story-bar block h-full rounded-full bg-brand" style={{ width: `${u.pct}%` }} />
                  </span>
                  <span className="text-right text-fg-tertiary tabular">{u.pct}%</span>
                </div>
              ))}
              <p className="flex items-center gap-1.5 text-xs text-accent-fg">
                <Sparkles className="size-3.5" /> Templates are barely used. Sell them as an add-on?
              </p>
            </div>
          </Window>
        </div>
      ) : null}
    </div>
  );
}

/* ── Shared ───────────────────────────────────────────────────────────────── */

function Window({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-bg shadow-soft", className)}>
      <div className="flex h-9 items-center gap-2 border-b border-border bg-panel px-3 text-xs text-fg-tertiary">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-bg-active" />
          <span className="size-2 rounded-full bg-bg-active" />
          <span className="size-2 rounded-full bg-bg-active" />
        </span>
        <span className="ml-2 font-mono">{title}</span>
        <span className="ml-auto">{aside}</span>
      </div>
      {children}
    </div>
  );
}
