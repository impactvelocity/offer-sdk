import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_URL, GITHUB_URL, RENDER_DEPLOY_URL } from "@/lib/env";
import { cn } from "@/lib/utils";

/**
 * The checkout-style summary beside the What you get page: every product as an included line
 * item, the bonuses as one free line, then the $99 subtotal discounted to $0. Sticky on wide
 * screens, so it's kept short enough to fit a laptop viewport.
 */
export function OrderSummary({
  products,
  bonuses,
  className,
}: {
  products: { id: string; name: string }[];
  bonuses: { name: string }[];
  className?: string;
}) {
  return (
    <aside
      aria-labelledby="order-summary"
      className={cn("rounded-2xl border border-border-strong bg-panel shadow-lg", className)}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-border px-6 py-4">
        <h2 id="order-summary" className="text-lg font-medium text-fg">
          Order summary
        </h2>
        <span className="text-xs text-fg-tertiary">{products.length + bonuses.length} items</span>
      </div>

      <ul className="divide-y divide-border px-6">
        {products.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <a href={`#${p.id}`} className="focus-ring rounded-sm text-fg hover:underline hover:underline-offset-2">
              {p.name}
            </a>
            <span className="shrink-0 font-mono text-xs text-fg-tertiary">Included</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
          <a href="#bonuses" className="focus-ring min-w-0 rounded-sm hover:underline hover:underline-offset-2">
            <span className="text-fg">{bonuses.length} bonuses</span>
            <span className="mt-0.5 block text-xs text-fg-muted">{bonuses.map((b) => b.name).join(", ")}</span>
          </a>
          <span className="shrink-0 font-mono text-xs text-accent-fg">Free</span>
        </li>
      </ul>

      <dl className="space-y-2 border-t border-border px-6 py-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-fg-tertiary">Subtotal</dt>
          <dd className="text-fg tabular">$99.00</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 text-fg-tertiary">
            Discount
            <span className="rounded border border-dashed border-accent/60 px-1.5 py-px font-mono text-[11px] text-accent-fg">
              OPENSOURCE
            </span>
          </dt>
          <dd className="text-accent-fg tabular">−$99.00</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-fg-tertiary">Hosting</dt>
          <dd className="text-right text-fg-secondary">Your own Render account</dd>
        </div>
      </dl>

      <div className="flex items-end justify-between gap-4 border-t border-border px-6 py-5">
        <span className="text-fg">Total due today</span>
        <span className="flex items-baseline gap-2">
          <span className="text-sm text-fg-muted line-through tabular">$99.00</span>
          <span className="font-display text-4xl font-medium text-fg tabular">$0.00</span>
        </span>
      </div>

      <div className="space-y-3 px-6 pb-6">
        <a
          href={RENDER_DEPLOY_URL}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "primary", size: "xl", className: "w-full" })}
        >
          Deploy on Render
          <ArrowRight />
        </a>
        <a href={`${APP_URL}/demo-account`} className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}>
          Try the demo account
        </a>
        <p className="pt-1 text-center text-xs text-fg-muted">
          No card, and no account with us.{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-fg-tertiary underline decoration-fg-muted/40 underline-offset-2 hover:text-fg"
          >
            Read the source on GitHub
          </a>
        </p>
      </div>
    </aside>
  );
}
