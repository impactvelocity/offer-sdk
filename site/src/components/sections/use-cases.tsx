import { ArrowRight, Check, Clock, FlaskConical, Handshake, LifeBuoy, Megaphone, TrendingUp, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/section-heading";
import { Badge, IconTile, type BadgeColor } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const funnel: { step: string; offer: string; price: string; grants: string[]; color: BadgeColor }[] = [
  { step: "Front-end offer", offer: "Pro plan", price: "$29/mo", grants: ["Pro features", "1,000 credits"], color: "purple" },
  { step: "Order bump", offer: "Resource pack", price: "+$19", grants: ["Templates add-on", "Instant delivery"], color: "orange" },
  { step: "Upsell", offer: "Go yearly", price: "$249/yr", grants: ["2 months free", "+2,000 credits"], color: "pink" },
  { step: "Downsell", offer: "Starter", price: "$9/mo", grants: ["Core features", "200 credits"], color: "blue" },
];

const cases: { icon: ReactNode; color: BadgeColor; title: string; body: string; detail: ReactNode; wide?: boolean }[] = [
  {
    icon: <TrendingUp />,
    color: "green",
    title: "Upsells at the limit",
    body: "When an account runs low on credits, show the next plan up and take payment through PayPal.",
    detail: <Detail icon={<TrendingUp />}>Upgrade shown at 90% of the credit limit</Detail>,
  },
  {
    icon: <LifeBuoy />,
    color: "pink",
    title: "Churn saves",
    body: "Give more instead of discounting. Add credits or seats the moment someone clicks cancel.",
    detail: <Detail icon={<Check />}>+500 credits and 5 seats granted</Detail>,
  },
  {
    icon: <Handshake />,
    color: "blue",
    title: "Partner bundles",
    body: "Make a bundle for one partner. Buyers from their link are credited to them and get access on their own.",
    detail: <Detail icon={<ArrowRight />}>offer.to/sarah · auto-credited</Detail>,
  },
  {
    icon: <Megaphone />,
    color: "orange",
    title: "Time-limited promos",
    body: "Launch a Black Friday price with an end date. When it passes, the link stops selling and there's no code to clean up.",
    detail: <Detail icon={<Clock />}>BF24 ends Sunday at midnight</Detail>,
    wide: true,
  },
  {
    icon: <FlaskConical />,
    color: "teal",
    title: "Pricing tests",
    body: "Put two packages on two links and compare how many buyers check out on each.",
    detail: (
      <span className="flex w-full gap-1.5 text-xs">
        <span className="flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-fg-secondary">A · Pro $29</span>
        <span className="flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-fg-secondary">B · Pro + credits $35</span>
      </span>
    ),
    wide: true,
  },
];

/** Use cases: funnels across the full width (with a step-by-step flow), then five cards. */
export function UseCasesSection() {
  return (
    <section id="use-cases" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <SectionHeading title="Funnels, saves, partner deals and promos, without an engineering ticket" />

      <div className="mt-12 grid gap-4 md:grid-cols-6">
        <article className="rounded-2xl border border-border bg-panel p-6 md:col-span-6 sm:p-8">
          <div className="max-w-md">
            <IconTile color="purple">
              <Workflow />
            </IconTile>
            <h3 className="mt-5 text-xl font-semibold">Funnels with bumps, upsells and downsells</h3>
            <p className="mt-2 text-sm text-fg-muted">
              Each step grants its own features, credits or add-ons. Change a step in the dashboard and the next
              buyer gets the new access.
            </p>
          </div>

          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {funnel.map((s, i) => (
              <li key={s.step} className="relative rounded-xl border border-border bg-bg p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-fg-tertiary tabular">
                    {i + 1} · {s.step}
                  </span>
                  <Badge color={s.color}>{s.price}</Badge>
                </div>
                <p className="mt-3 font-medium text-fg">{s.offer}</p>
                <ul className="mt-2 space-y-1">
                  {s.grants.map((g) => (
                    <li key={g} className="flex items-center gap-1.5 text-xs text-fg-secondary">
                      <Check className="size-3 text-success-fg" strokeWidth={3} />
                      {g}
                    </li>
                  ))}
                </ul>
                {i < funnel.length - 1 ? (
                  <ArrowRight
                    aria-hidden
                    className="absolute top-1/2 -right-[13px] z-10 hidden size-4 -translate-y-1/2 rounded-full bg-panel text-fg-icon lg:block"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </article>

        {cases.map((c) => (
          <article
            key={c.title}
            className={cn("flex flex-col rounded-2xl border border-border bg-panel p-6", c.wide ? "md:col-span-3" : "md:col-span-2")}
          >
            <IconTile color={c.color}>{c.icon}</IconTile>
            <h3 className="mt-5 text-lg font-semibold">{c.title}</h3>
            <p className="mt-1.5 text-sm text-fg-muted">{c.body}</p>
            <div className="mt-auto flex pt-5">{c.detail}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg-secondary [&_svg]:size-3 [&_svg]:text-fg-icon">
      {icon}
      {children}
    </span>
  );
}
