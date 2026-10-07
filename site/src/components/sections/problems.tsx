import type { ReactNode } from "react";
import { SectionHeading } from "@/components/section-heading";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

const before = `if (user.plan === "pro" || user.plan === "team") {
  enableExports();
}
if (user.id === "acme_corp") {
  // custom deal, ask Dave
  seats = 50;
  enableSso();
}
if (promo === "BF24" && Date.now() < BF_END) {
  price = 199;
}
// TODO: affiliate bundles???`;

const after = `const exports = useEntitlement("exports");
const seats = useEntitlement("seats");

// Plans, custom deals, promos and partner
// bundles all live in the dashboard.`;

const requests: { ask: string; fix: string }[] = [
  { ask: "A customer asks for a longer trial.", fix: "Give that account a trial incentive." },
  { ask: "Acme wants 50 seats and SSO on Team.", fix: "Make Acme a custom plan." },
  { ask: "An influencer wants a deal for their audience.", fix: "Create an offer with its own link." },
  { ask: "Nobody knows who uses the features you gate.", fix: "See usage per feature and per account." },
];

/** The problem: hardcoded plan checks vs. a flexible offer, then four everyday requests and what each takes. */
export function ProblemsSection() {
  return (
    <section id="problem" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
      <SectionHeading
        title="Every deal you say yes to ends up in your code."
        lead="And the next one sends you back to billing.ts."
      />

      <div className="mt-16 grid items-stretch gap-4 lg:grid-cols-2">
        <Verdict tone="danger" quote="“Sorry, I can't do that.”" caption="Plans hardcoded in your app">
          <CodeBlock title="billing.ts" code={before} className="flex-1 shadow-none" />
        </Verdict>
        <Verdict tone="success" quote="“Sold.”" caption="Plans and deals stored in Offer SDK">
          <CodeBlock title="billing.ts" code={after} className="flex-1 shadow-none" />
          <p className="flex flex-wrap gap-x-2 px-1 text-sm text-fg-muted">
            {["Custom plan for Acme", "BF24 promo, ends Sunday", "Bundle for @sarahbuilds"].map((d, i) => (
              <span key={d} className="whitespace-nowrap">
                {i > 0 && <span className="mr-2" aria-hidden>·</span>}
                {d}
              </span>
            ))}
          </p>
        </Verdict>
      </div>

      <ul className="mt-16 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {requests.map((r) => (
          <li key={r.ask} className="border-t border-border pt-5 text-lg/7 text-pretty">
            <span className="text-fg">{r.ask}</span> <span className="text-fg-muted">{r.fix}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Verdict({
  tone,
  quote,
  caption,
  children,
}: {
  tone: "danger" | "success";
  quote: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-border bg-panel p-4 sm:p-5",
        tone === "success" && "border-accent/30",
      )}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span
          className={cn("font-display text-xl font-medium", tone === "danger" ? "text-fg-muted" : "text-accent-fg")}
        >
          {quote}
        </span>
        <span className="text-xs text-fg-muted">{caption}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </div>
  );
}
