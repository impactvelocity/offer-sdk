"use client";

import { ArrowUpRight, Check, Copy, Plug } from "lucide-react";
import { useMemo, useState } from "react";
import { Md } from "@/components/developers/bits";
import type { Examples } from "@/components/developers/use-dev-context";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardHeader } from "@/components/ui/card";
import { CodeBlock, CodeTabs } from "@/components/ui/code-block";
import { useCopy } from "@/components/ui/copy-button";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ClientIcon } from "./bits";
import { CLIENTS, clientSetup, type ClientId, type McpAuth } from "./clients";

export function ConnectTab({
  url,
  examples,
  usageName,
  isToolOn,
}: {
  url: string;
  examples: Examples;
  usageName: string;
  isToolOn: (name: string) => boolean;
}) {
  const [client, setClient] = useState<ClientId>("claude");
  const [auth, setAuth] = useState<McpAuth>("oauth");
  const info = CLIENTS.find((c) => c.id === client) ?? CLIENTS[0];
  const effectiveAuth = info.oauthOnly ? "oauth" : auth;
  const setup = useMemo(() => clientSetup(client, url, effectiveAuth), [client, url, effectiveAuth]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0">
        <CardHeader title="Connect a client" description="Pick where you'll use Offer. Every client gets the same tools." />
        <div className="grid grid-cols-2 gap-2 border-b border-border p-4 sm:grid-cols-3">
          {CLIENTS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={client === c.id}
              onClick={() => setClient(c.id)}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--ring)]",
                client === c.id ? "border-accent/40 bg-accent-subtle" : "border-border hover:bg-bg-subtle",
              )}
            >
              <ClientIcon client={c.id} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                <span className="block truncate text-xs text-fg-tertiary">{c.tagline}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold text-fg">Set up {info.name}</h3>
            <Tooltip content={info.oauthOnly ? `${info.name} connects with OAuth only.` : null}>
              <span>
                <Segmented<McpAuth>
                  value={effectiveAuth}
                  onValueChange={setAuth}
                  options={[
                    { value: "oauth", label: "OAuth" },
                    { value: "key", label: "API key", disabled: info.oauthOnly },
                  ]}
                />
              </span>
            </Tooltip>
          </div>

          <ol className="flex flex-col gap-2.5">
            {setup.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-fg-secondary">
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-muted text-[11px] font-semibold tabular text-fg-secondary">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <Md>{step}</Md>
                </span>
              </li>
            ))}
          </ol>

          {setup.snippets.length === 1 ? (
            <CodeBlock title={setup.snippets[0].label} code={setup.snippets[0].code} lang={setup.snippets[0].lang} />
          ) : (
            <CodeTabs key={`${client}-${effectiveAuth}`} tabs={setup.snippets} />
          )}

          {setup.installUrl ? (
            <div>
              <a href={setup.installUrl} className={buttonVariants({ variant: "primary" })}>
                <Plug />
                Add to {info.name}
              </a>
            </div>
          ) : null}

          {effectiveAuth === "key" ? (
            <Callout tone="warning" title="The secret key has full access">
              It skips the sign-in step, so the access level and tool switches don&apos;t apply. Use OAuth for people, and the key
              for CI jobs and scripts you control.
            </Callout>
          ) : (
            <p className="text-xs text-fg-tertiary">
              OAuth asks the person connecting to sign in to Offer and approve an access level. They only see apps in workspaces
              they belong to, and you can revoke them from Connections.
            </p>
          )}
        </div>
      </Card>

      <div className="grid min-w-0 grid-cols-1 content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
        <TryAsking examples={examples} usageName={usageName} isToolOn={isToolOn} />
        <HowItWorks />
      </div>
    </div>
  );
}

function TryAsking({ examples: ex, usageName, isToolOn }: { examples: Examples; usageName: string; isToolOn: (name: string) => boolean }) {
  const account = ex.accountName ?? ex.account;
  const prompts = [
    { text: `Give ${account} the ${ex.incentive} incentive and tell me what changes for them.`, tools: ["get_account_access", "update_account"] },
    { text: `Which accounts used the most ${usageName} in the last 30 days?`, tools: ["top_accounts_by_usage", "get_account"] },
    { text: `Raise ${ex.planEntitlement} on the ${ex.plan} plan to 5,000.`, tools: ["get_plan", "set_plan_entitlement_limit"] },
    { text: `Create a Black Friday offer with unlimited ${ex.usageEntitlement}.`, tools: ["create_incentive", "attach_incentive_entitlement"] },
    { text: "Why are our webhook deliveries failing?", tools: ["list_webhooks", "list_webhook_deliveries"] },
  ];
  return (
    <Card>
      <CardHeader title="Try asking" description="Written against this app's real IDs." />
      <ul className="divide-y divide-border">
        {prompts.map((p) => (
          <PromptRow key={p.text} text={p.text} tools={p.tools} isToolOn={isToolOn} />
        ))}
      </ul>
    </Card>
  );
}

function PromptRow({ text, tools, isToolOn }: { text: string; tools: string[]; isToolOn: (name: string) => boolean }) {
  const { copied, copy } = useCopy();
  const blocked = tools.filter((t) => !isToolOn(t));
  return (
    <li>
      <button
        type="button"
        onClick={() => copy(text)}
        className="group flex w-full flex-col gap-2 px-5 py-3 text-left outline-none transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle"
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-sm text-fg">“{text}”</span>
          <span className="mt-0.5 shrink-0 text-fg-icon opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [&_svg]:size-3.5">
            {copied ? <Check /> : <Copy />}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {tools.map((t) => (
            <code
              key={t}
              className={cn(
                "rounded-[4px] px-1.5 py-px text-[11.5px]",
                isToolOn(t) ? "bg-bg-muted text-fg-secondary" : "bg-bg-muted text-fg-placeholder line-through",
              )}
            >
              {t}
            </code>
          ))}
          {blocked.length ? <Badge color="gray">Tool off</Badge> : null}
        </span>
      </button>
    </li>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Your assistant picks a tool", body: "Each tool is one endpoint from the API reference, with the same parameters." },
    { title: "Offer checks the connection", body: "The server is scoped to this app and enforces the access level you approved." },
    { title: "Changes apply right away", body: "Same as editing in the dashboard: no deploy, and every call lands in Activity." },
  ];
  return (
    <Card>
      <CardHeader title="How it works" />
      <ol className="flex flex-col gap-4 px-5 py-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold tabular text-accent-contrast">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{s.title}</p>
              <p className="mt-0.5 text-sm text-fg-tertiary">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-border px-5 py-3">
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-fg-tertiary transition-colors hover:text-accent-fg"
        >
          What is MCP?
          <ArrowUpRight className="size-3" />
        </a>
      </div>
    </Card>
  );
}
