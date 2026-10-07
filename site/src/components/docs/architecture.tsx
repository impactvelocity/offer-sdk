import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Box({ title, detail, highlight }: { title: ReactNode; detail: ReactNode; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-bg px-4 py-3",
        highlight ? "border-accent/60 shadow-[0_0_24px_-12px_var(--accent)]" : "border-border",
      )}
    >
      <div className={cn("text-sm font-medium", highlight ? "text-accent-fg" : "text-fg")}>{title}</div>
      <div className="mt-0.5 text-xs/5 text-fg-tertiary">{detail}</div>
    </div>
  );
}

/** One connector per column on wide screens, labelled with what crosses it; a single line when stacked. */
function Wires({ labels }: { labels: string[] }) {
  return (
    <>
      <div className={cn("hidden gap-3 sm:grid", labels.length === 3 ? "grid-cols-3" : "grid-cols-4")} aria-hidden>
        {labels.map((label, i) => (
          <div key={i} className="flex h-10 items-stretch justify-center gap-2">
            <span className="w-px bg-border-strong" />
            <span className="self-center font-mono text-[11px] text-fg-icon">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex h-6 justify-center sm:hidden" aria-hidden>
        <span className="w-px bg-border-strong" />
      </div>
    </>
  );
}

/** The deployed stack: who calls the API with which credential, and what the API calls out to. */
export function ArchitectureDiagram() {
  return (
    <figure className="docs-block rounded-xl border border-border bg-panel p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Box title="Your app" detail="React SDK in the browser, your server with the secret key" />
        <Box title="Dashboard" detail="offer-app (Next.js). Its BFF calls the API as admin" />
        <Box title="Render Workflows" detail="offersdk-workflows: subscription pauses" />
      </div>
      <Wires labels={["app keys · act_ token", "admin key", "admin key"]} />
      <Box highlight title="Offer API" detail="offersdk-api (Hono on Bun). Holds every record, signs webhooks, prices checkouts" />
      <Wires labels={["SQL", "REST", "Messages API", "signed POST"]} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box title="Postgres" detail="offersdk-db" />
        <Box title="PayPal" detail="Orders, subscriptions, webhooks" />
        <Box title="AI model" detail="Dynamic save offers" />
        <Box title="Webhooks" detail="Your endpoints and Zapier" />
      </div>
      <figcaption className="mt-5 text-xs/5 text-fg-tertiary">
        The dashboard also calls the AI model directly for its agent chat, and proxies sign-in to the API so session
        cookies stay on its own domain.
      </figcaption>
    </figure>
  );
}
