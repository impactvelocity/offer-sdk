import { Check, ChevronDown, ChevronRight, Sparkles, Zap } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import adminOverview from "@/assets/admin-overview.png";
import { AppWindow } from "@/components/demo/controls";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

/*
 * Product mockups for the What you get page: one per line item and a small one per bonus.
 * Static HTML built from the design tokens.
 */

const endpoints: { method: "GET" | "POST"; path: string; note: string; active?: boolean }[] = [
  { method: "GET", path: "/namespaces/acct_42/full-plan", note: "Everything the account can use" },
  { method: "POST", path: "/namespaces/acct_42/usage/ai_credits/add", note: "402 with an upgrade at the limit", active: true },
  { method: "POST", path: "/offers/spring_launch/checkout", note: "PayPal approval link" },
  { method: "POST", path: "/cancel-sessions", note: "Opens a cancel flow" },
];

const limitReached = `{
  "error": "limit_reached",
  "message": "You've used 5,000 of 5,000 AI credits on the Pro plan…",
  "offer": {
    "plan": { "id": "team", "name": "Team" },
    "interval": "month",
    "price": 79,
    "new_limit": 25000,
    "checkout_url": "https://www.paypal.com/checkoutnow?token=…"
  },
  "retry_after_purchase": true
}`;

export function ApiVisual() {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-bg">
        <div className="flex h-9 items-center border-b border-border bg-panel px-4 font-mono text-[11px] text-fg-tertiary">
          <span className="truncate">offersdk-api.onrender.com/apps/app_123</span>
        </div>
        <ul className="divide-y divide-border">
          {endpoints.map((e) => (
            <li
              key={e.path}
              className={cn("flex items-center gap-3 px-4 py-2.5 font-mono text-xs", e.active && "bg-bg-active")}
            >
              <span
                className={cn(
                  "w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium",
                  e.method === "GET" ? "bg-tag-green-bg text-tag-green-fg" : "bg-tag-blue-bg text-tag-blue-fg",
                )}
              >
                {e.method}
              </span>
              <span className="min-w-0 truncate text-fg-secondary">{e.path}</span>
              <span className="ml-auto hidden shrink-0 font-sans text-fg-muted md:inline">{e.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <CodeBlock title="402 Payment Required" code={limitReached} className="shadow-none" />
    </div>
  );
}

export function AdminVisual() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-strong bg-bg shadow-lg">
      <Image
        src={adminOverview}
        alt="The Offer SDK dashboard: an app's overview with account and plan counts, a 30-day usage chart, accounts by plan and recent activity."
        placeholder="blur"
        sizes="(min-width: 1024px) 640px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}

const clients = ["Any MCP client", "Cursor", "VS Code", "ChatGPT"];

export function McpVisual() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {clients.map((c, i) => (
          <span
            key={c}
            className={cn(
              "inline-flex h-7 items-center rounded-full px-3 text-xs ring-1 ring-inset",
              i === 0 ? "bg-bg-active text-fg ring-border-strong" : "text-fg-tertiary ring-border",
            )}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-bg">
        <div className="flex h-9 items-center gap-2 border-b border-border bg-panel px-4 text-xs text-fg-tertiary">
          AI assistant
          <span className="text-fg-muted">·</span>
          <span className="font-mono">Offer connector</span>
        </div>
        <div className="space-y-3 p-4">
          <p className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-bg-active px-3.5 py-2.5 text-sm text-fg">
            Who&apos;s about to run out of AI credits? Give the top account 500 bonus credits.
          </p>
          <ToolCall name="top_accounts_by_usage" args='entitlement: "ai_credits"' result="5 accounts" />
          <ToolCall name="update_account" args='namespaceId: "acct_42", incentive: "bonus_500"' result="200" />
          <p className="text-sm text-fg-secondary">
            Ada Turing (acct_42) has used 96% of 5,000 credits. I attached the 500-credit bonus, so the account&apos;s
            next full-plan check shows 5,500.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolCall({ name, args, result }: { name: string; args: string; result: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 font-mono text-xs">
      <span className="min-w-0 truncate text-accent-fg sm:shrink-0">{name}</span>
      <span className="hidden min-w-0 truncate text-fg-muted sm:inline">{args}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1 text-success-fg">
        <Check className="size-3" />
        {result}
      </span>
    </div>
  );
}

export function CheckoutVisual() {
  return (
    <div className="space-y-3">
      <AppWindow url="yourapp.com/checkout?offer=spring_launch&ref=sarah">
        <div className="space-y-4 p-5">
          <div>
            <p className="font-display text-xl font-medium text-fg">Spring launch: Pro for less</p>
            <p className="mt-0.5 text-sm text-fg-muted">From @sarahbuilds · ends Sunday</p>
          </div>
          <div aria-hidden className="grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1 ring-1 ring-border">
            <span className="flex h-8 items-center justify-center rounded-md text-sm text-fg-tertiary">Monthly</span>
            <span className="flex h-8 items-center justify-center rounded-md bg-bg-active text-sm text-fg shadow-xs">
              Yearly
            </span>
          </div>
          <div className="rounded-lg bg-panel p-4 ring-1 ring-accent ring-inset">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="flex items-center gap-2 font-medium text-fg">
                Pro <Badge color="brand">Save 31%</Badge>
              </p>
              <p className="flex items-baseline gap-1.5 text-right">
                <span className="text-sm text-fg-muted line-through tabular">$348</span>
                <span className="font-display text-xl font-semibold text-fg tabular">$239</span>
                <span className="text-xs text-fg-tertiary">/yr</span>
              </p>
            </div>
            <p className="mt-1.5 text-xs text-fg-tertiary">5,000 AI credits · Exports · 10 seats</p>
          </div>
          <div className="flex gap-3 rounded-lg border border-dashed border-accent/50 p-3">
            <Checkmark />
            <div className="min-w-0">
              <p className="text-sm text-fg">
                Add the template pack <span className="text-fg-muted tabular">+$19</span>
              </p>
              <p className="text-xs text-fg-muted">40 starter docs, yours to keep</p>
            </div>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-4 text-sm">
            <span className="text-fg-tertiary">Due today</span>
            <span className="font-medium text-fg tabular">$258.00</span>
          </div>
          <PayPalButton>Pay with PayPal</PayPalButton>
        </div>
      </AppWindow>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-tertiary">
        <span className="mr-1">Granted on payment</span>
        <Badge color="brand">Pro plan</Badge>
        <Badge color="purple">+2,000 AI credits</Badge>
        <Badge color="orange">Template pack</Badge>
      </div>
    </div>
  );
}

const reasons = ["It's too expensive", "I'm not using it enough", "I'm switching to another tool", "Something else"];

export function CancelVisual() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg p-4">
          <p className="font-medium text-fg">Why are you cancelling?</p>
          <ul className="mt-3 space-y-1.5">
            {reasons.map((r, i) => (
              <li
                key={r}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ring-1 ring-inset",
                  i === 0 ? "bg-bg-active text-fg ring-accent" : "text-fg-tertiary ring-border",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 rounded-full ring-1 ring-inset",
                    i === 0 ? "bg-accent ring-accent shadow-[inset_0_0_0_3px_var(--bg-active)]" : "ring-border-strong",
                  )}
                />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-bg p-4">
          <p className="flex items-start gap-2 text-xs text-fg-tertiary">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-tag-pink-fg" />
            Pro since March, active 26 of the last 30 days. Price is the reason, so a discount within your 40% cap.
          </p>
          <p className="mt-4 font-medium text-fg">Before you go: 30% off Pro</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold text-fg tabular">$20.30</span>
            <span className="text-sm text-fg-muted line-through tabular">$29</span>
            <span className="text-xs text-fg-tertiary">/mo for 3 payments</span>
          </p>
          <div className="mt-auto space-y-2 pt-4">
            <PayPalButton>Approve in PayPal</PayPalButton>
            <span className="flex h-8 items-center justify-center text-xs text-fg-muted">Cancel anyway</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-tertiary">
        <span className="mr-1">Guardrails</span>
        <Badge>Up to 40% off</Badge>
        <Badge>3 payments max</Badge>
        <Badge>Pause up to 3 months</Badge>
      </div>
    </div>
  );
}

/* Bonuses. */

const recipes: { event: string; action: string }[] = [
  { event: "account.plan_changed", action: "Post to Slack" },
  { event: "account.created", action: "Add to your CRM" },
  { event: "usage.limit_reached", action: "Email the customer" },
];

export function ZapierVisual() {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
      {recipes.map((r) => (
        <li key={r.event} className="flex items-center gap-2.5 px-3 py-2">
          <Zap className="size-3.5 shrink-0 text-fg-icon" />
          <span className="min-w-0">
            <span className="block text-xs text-fg-secondary">{r.action}</span>
            <span className="block truncate font-mono text-[11px] text-fg-muted">{r.event}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const folders: { name: string; requests?: { method: "GET" | "POST"; name: string }[] }[] = [
  {
    name: "Accounts",
    requests: [
      { method: "GET", name: "Get full plan" },
      { method: "POST", name: "Add usage" },
    ],
  },
  { name: "Plans" },
  { name: "Offers" },
  { name: "Checkouts" },
  { name: "Cancel sessions" },
];

export function PostmanVisual() {
  return (
    <div className="rounded-lg border border-border bg-bg text-xs">
      <div className="py-1.5">
        <p className="px-3 py-1 font-medium text-fg">Offer API</p>
        {folders.map((f) => (
          <div key={f.name}>
            <p className={cn("flex items-center gap-1.5 px-3 py-1", f.requests ? "text-fg-secondary" : "text-fg-tertiary")}>
              {f.requests ? <ChevronDown className="size-3 text-fg-icon" /> : <ChevronRight className="size-3 text-fg-icon" />}
              {f.name}
            </p>
            {f.requests?.map((r) => (
              <p key={r.name} className="flex items-center gap-2 py-0.5 pr-3 pl-8">
                <span
                  className={cn(
                    "w-8 shrink-0 font-mono text-[10px] font-medium",
                    r.method === "GET" ? "text-tag-green-fg" : "text-tag-blue-fg",
                  )}
                >
                  {r.method}
                </span>
                <span className="truncate text-fg-tertiary">{r.name}</span>
              </p>
            ))}
          </div>
        ))}
      </div>
      <p className="truncate border-t border-border px-3 py-2 font-mono text-[11px] text-fg-muted">
        <span className="text-tag-orange-fg">{"{{baseUrl}}"}</span> · <span className="text-tag-orange-fg">{"{{secretKey}}"}</span>
      </p>
    </div>
  );
}

export function PayPalVisual() {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg p-3 text-xs">
      <div aria-hidden className="grid grid-cols-2 gap-1 rounded-md bg-canvas p-0.5 ring-1 ring-border">
        <span className="flex h-6 items-center justify-center rounded bg-bg-active text-fg">Sandbox</span>
        <span className="flex h-6 items-center justify-center text-fg-tertiary">Live</span>
      </div>
      <Field label="Client ID" value="AY3xQ…k9fQ" />
      <Field label="Secret" value="••••••••••••" />
      <p className="flex items-center gap-1.5 pt-1 text-success-fg">
        <span className="size-1.5 rounded-full bg-success" />
        Connected · webhook registered
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-8 items-center justify-between gap-3 rounded-md px-2.5 ring-1 ring-border-input ring-inset">
      <span className="text-fg-tertiary">{label}</span>
      <span className="truncate font-mono text-fg-secondary">{value}</span>
    </div>
  );
}

const services: { name: string; kind: string }[] = [
  { name: "offersdk-api", kind: "Web service" },
  { name: "offer-app", kind: "Web service" },
  { name: "offersdk-workflows", kind: "Workflow" },
  { name: "offersdk-db", kind: "Postgres" },
];

export function RenderVisual() {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
      {services.map((s) => (
        <li key={s.name} className="flex items-center gap-2 px-3 py-2 text-xs">
          <span className="size-1.5 shrink-0 rounded-full bg-success" />
          <span className="min-w-0 truncate font-mono text-fg-secondary">{s.name}</span>
          <span className="ml-auto shrink-0 text-fg-tertiary">{s.kind}</span>
        </li>
      ))}
    </ul>
  );
}

/* Shared bits. */

/** A checked checkbox, as drawn on an order bump. */
export function Checkmark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-accent text-accent-contrast",
        className,
      )}
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}

function PayPalButton({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-10 w-full items-center justify-center rounded-md bg-(--paypal) text-sm font-semibold text-(--paypal-fg)">
      {children}
    </span>
  );
}
