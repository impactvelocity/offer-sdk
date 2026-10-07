"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Braces, Code, Copy, Check, Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildPrompt, type PromptOptions } from "@/components/developers/ai-prompt";
import { CopyField, InlineCode, ToggleChip } from "@/components/developers/bits";
import { buildSdkSkill, SKILL_PATH, sdkFilesFor, type SdkFile, type SdkSkillOptions } from "@/components/developers/sdk-skill";
import { Callout } from "@/components/ui/callout";
import { GuideSection, OnThisPage, RefLink, useActiveSection } from "@/components/developers/guide-layout";
import * as snippets from "@/components/developers/snippets";
import { useDevContext, type DevContext } from "@/components/developers/use-dev-context";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CodeBlock, CodeTabs } from "@/components/ui/code-block";
import { useCopy } from "@/components/ui/copy-button";
import { SecretInput } from "@/components/ui/secret-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/hooks";
import { pluralize } from "@/lib/utils";

const SECTIONS = [
  { id: "keys", title: "Keys & base URL" },
  { id: "create-account", title: "Create accounts" },
  { id: "check-access", title: "Check access" },
  { id: "track-usage", title: "Track usage" },
  { id: "billing", title: "Billing webhooks" },
  { id: "pricing", title: "Pricing page" },
  { id: "sdk-skill", title: "React SDK skill" },
  { id: "ai-context", title: "AI assistant context" },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

export function IntegrationView({ sdkFiles }: { sdkFiles: SdkFile[] | null }) {
  const ctx = useDevContext();
  const [real, setReal] = useState(false);

  const snippet = useMemo(() => snippets.toSnippetContext(ctx, real), [ctx, real]);
  const ready = Boolean(snippet);
  const active = useActiveSection(SECTION_IDS, ready);

  // Sections render after data loads, so honour #section links once they exist.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (ready && SECTION_IDS.includes(id)) document.getElementById(id)?.scrollIntoView();
  }, [ready]);

  return (
    <>
      <PageHeader
        icon={<Code />}
        title="Integration"
        actions={
          <Link href={`/apps/${ctx.appId}/developers/api`} className={buttonVariants()}>
            <Braces />
            API reference
          </Link>
        }
      />
      <PageBody>
        <div className="mx-auto flex w-full max-w-[1040px] gap-10 px-6 py-8">
          <div className="min-w-0 max-w-[760px] flex-1">
            <header className="mb-6">
              <h1 className="font-display text-xl font-semibold text-fg">Integrate {ctx.app?.name ?? "your app"}</h1>
              <p className="mt-1 text-sm text-fg-secondary">
                Wire your product up once. After that, plans, limits and offers change from this dashboard — your code stays
                the same.
              </p>
            </header>

            <div className="mb-8 flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-bg-subtle px-4 py-3">
                <Switch checked={real} onCheckedChange={setReal} aria-label="Show real keys in snippets" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">Show real keys in snippets</span>
                  <span className="block text-xs text-fg-tertiary">
                    {real
                      ? "Snippets contain this app's live keys."
                      : "Snippets read keys from environment variables, so they're safe to share."}
                  </span>
                </span>
              </label>
              {real ? (
                <Callout tone="warning" title="Your real keys are in the snippets below">
                  Don&apos;t paste them into client-side code, screenshots, tickets or chats. Anyone with the secret key has full
                  access to this app.
                </Callout>
              ) : null}
            </div>

            {!snippet ? (
              ctx.error ? (
                <Callout tone="danger" title="Couldn't load this app">
                  {ctx.error.message}
                </Callout>
              ) : (
                <GuideSkeleton />
              )
            ) : (
              <Guide ctx={ctx} s={snippet} sdkFiles={sdkFiles} />
            )}
          </div>
          <aside className="hidden w-44 shrink-0 xl:block">
            <OnThisPage sections={SECTIONS} active={active} />
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function GuideSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

function Guide({ ctx, s, sdkFiles }: { ctx: DevContext; s: snippets.SnippetContext; sdkFiles: SdkFile[] | null }) {
  const { appId, app } = ctx;
  if (!app) return null;
  return (
    <>
      {!ctx.plans.length || !ctx.entitlements.length ? (
        <Callout title="Examples use placeholder IDs" className="mb-8">
          Snippets use IDs like <InlineCode>{s.ex.plan}</InlineCode> and <InlineCode>{s.ex.usageEntitlement}</InlineCode> until
          this app has <Link href={`/apps/${appId}/plans`}>plans</Link> and{" "}
          <Link href={`/apps/${appId}/entitlements`}>entitlements</Link>. Add them and the guide fills in your real ones.
        </Callout>
      ) : null}
      <GuideSection
        id="keys"
        step={1}
        title="Keys & base URL"
        description="Every request sends one of this app's keys as a bearer token. Keep the secret key on your server."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
          <FieldLabel
            label="Base URL"
            badge={ctx.mode === "mock" ? <Badge color="orange">Mock API</Badge> : <Badge color="green">Hosted</Badge>}
          />
          <CopyField value={ctx.baseUrl} />
          <FieldLabel label="App ID" />
          <CopyField value={appId} />
          <FieldLabel label="Secret key" hint="Server only" />
          <SecretInput value={app.api_key} />
          <FieldLabel label="Public key" hint="Safe for browsers: read access + usage tracking" />
          <SecretInput value={app.public_key} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-fg-tertiary">
            All routes live under <InlineCode>/apps/{appId}</InlineCode> and send{" "}
            <InlineCode>Authorization: Bearer &lt;key&gt;</InlineCode>.
          </p>
          <Link href={`/apps/${appId}/developers/keys`} className={buttonVariants({ variant: "link" })}>
            Manage keys
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <CodeTabs
          tabs={[
            { label: ".env", code: snippets.envFile(s), lang: "env" },
            { label: "Shell", code: snippets.shellExports(s), lang: "bash" },
          ]}
        />
        {!s.real ? (
          <p className="-mt-2 text-xs text-fg-tertiary">Keys are masked. Turn on “Show real keys in snippets” for a file you can paste.</p>
        ) : null}
      </GuideSection>

      <GuideSection
        id="create-account"
        step={2}
        title="Create an account when someone signs up"
        description={
          <>
            An account is one of your customers: a user or a workspace. Use your own ID for it, and give it a plan. Call this
            from your server with the secret key.
          </>
        }
      >
        <CodeTabs tabs={snippets.createAccount(s)} />
        <Notes>
          <li>
            Returns <InlineCode>201</InlineCode> with the account, or <InlineCode>409</InlineCode> if the ID already exists:
            treat that as success so sign-up retries are safe.
          </li>
          <li>
            <InlineCode>plan</InlineCode> must exist (<InlineCode>404</InlineCode> otherwise). Add{" "}
            <InlineCode>incentive</InlineCode> to start them on an offer.
          </li>
          {ctx.plans.length ? (
            <li>
              Your plan IDs:{" "}
              {ctx.plans.map((p, i) => (
                <span key={p.id}>
                  {i ? ", " : null}
                  <InlineCode>{p.id}</InlineCode>
                </span>
              ))}
            </li>
          ) : null}
        </Notes>
        <RefLink appId={appId} method="POST" path="/apps/:appId/namespaces" />
      </GuideSection>

      <GuideSection
        id="check-access"
        step={3}
        title="Check what they can do"
        description="One call returns the account's plan with any offer applied, its add-ons, and every entitlement with live usage. The public key works here, so you can call it from the browser."
      >
        <CodeTabs tabs={snippets.checkAccess(s)} />
        <LiveAccess ctx={ctx} />
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-border px-5 py-4 text-sm sm:grid-cols-[110px_minmax(0,1fr)]">
          <Term>can</Term>
          <dd className="text-fg-secondary">
            Whether they can use it right now: <InlineCode>usage &lt; max</InlineCode>, or always true when unlimited. Gate on
            this.
          </dd>
          <Term>left</Term>
          <dd className="text-fg-secondary">
            What&apos;s left (<InlineCode>max - usage</InlineCode>, never below 0), or <InlineCode>null</InlineCode> when
            unlimited.
          </dd>
          <Term>max: null</Term>
          <dd className="text-fg-secondary">Unlimited.</dd>
          <Term>boolean</Term>
          <dd className="text-fg-secondary">
            Feature flags. They&apos;re listed (with <InlineCode>can: true</InlineCode>) when the plan or offer grants them.
            Anything not listed isn&apos;t granted.
          </dd>
          <Term>incentive</Term>
          <dd className="text-fg-secondary">The offer applied, if any. Its overrides are already merged in.</dd>
          <Term>plan.meta</Term>
          <dd className="text-fg-secondary">Your plan metadata, minus keys marked private.</dd>
        </dl>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-fg">In React</h3>
          <p className="mb-3 text-sm text-fg-secondary">
            A small hook plus a <InlineCode>&lt;Gate&gt;</InlineCode> component. Client checks are for the UI; repeat the check
            on your server before doing anything that costs you.
          </p>
          <CodeTabs tabs={snippets.reactHook(s)} />
        </div>
        <RefLink appId={appId} method="GET" path="/apps/:appId/namespaces/:namespaceId/plan" />
      </GuideSection>

      <GuideSection
        id="track-usage"
        step={4}
        title="Track usage"
        description={
          <>
            Count usage entitlements as customers use them: <InlineCode>add</InlineCode> (+1),{" "}
            <InlineCode>remove</InlineCode> (−1) or <InlineCode>amount</InlineCode> (adds any integer). Works with either key.
          </>
        }
      >
        <Callout tone="warning" title="Writes don't enforce limits">
          The count goes past <InlineCode>max</InlineCode> if you let it. Check <InlineCode>can</InlineCode> first, then track
          once the action succeeds.
        </Callout>
        <CodeTabs tabs={snippets.trackUsage(s)} />
        <Notes>
          <li>
            Only <InlineCode>usage</InlineCode> entitlements can be tracked; boolean ones return <InlineCode>400</InlineCode>.
          </li>
          <li>
            The public key can write usage, so browsers can track directly. Track anything you bill on from your server.
          </li>
          <li>
            To reset a monthly quota, post the negative of the current count to <InlineCode>/amount</InlineCode>.
          </li>
        </Notes>
        <RefLink appId={appId} method="POST" path="/apps/:appId/namespaces/:namespaceId/usage/:entitlementId/amount" />
      </GuideSection>

      <GuideSection
        id="billing"
        step={5}
        title="Change plans from your billing webhooks"
        description="When someone pays, upgrades or cancels, move their account to the matching plan. Their limits update on the next check; no deploy needed."
      >
        <CodeTabs tabs={snippets.billingWebhook(s)} />
        <Notes>
          <li>
            <InlineCode>PATCH</InlineCode> is a shallow merge: send only <InlineCode>plan</InlineCode>,{" "}
            <InlineCode>incentive</InlineCode> or <InlineCode>name</InlineCode>. Unknown plans or incentives return{" "}
            <InlineCode>404</InlineCode>.
          </li>
          <li>Usage counters carry over when the plan changes.</li>
        </Notes>
        <RefLink appId={appId} method="PATCH" path="/apps/:appId/namespaces/:namespaceId" />
      </GuideSection>

      <GuideSection
        id="pricing"
        step={6}
        title="Render your pricing page"
        description="Pricing cards come from each plan's Pricing tab. The public key can read them, so fetch them straight from the page."
      >
        <CodeTabs tabs={snippets.pricing(s)} />
        <LivePricing ctx={ctx} />
        <RefLink appId={appId} method="GET" path="/apps/:appId/plans/pricing" />
      </GuideSection>

      <GuideSection
        id="sdk-skill"
        step={7}
        title="Install the React SDK with an agent"
        description="A skill for Claude Code, Cursor or any coding agent. It carries the SDK's source and this app's settings, so the agent copies the SDK into your React app and wires it up. The secret key is never included."
      >
        <SkillBuilder s={s} files={sdkFiles} />
      </GuideSection>

      <GuideSection
        id="ai-context"
        step={8}
        className="min-h-[75vh]"
        title="AI assistant context"
        description="Paste this into Claude, Cursor or Copilot. It describes this app's endpoints, IDs and response shapes, so the assistant writes the integration against your real catalog."
      >
        <PromptBuilder ctx={ctx} s={s} />
      </GuideSection>
    </>
  );
}

function FieldLabel({ label, hint, badge }: { label: string; hint?: string; badge?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary">
        {label}
        {badge}
      </span>
      {hint ? <span className="text-xs text-fg-tertiary">{hint}</span> : null}
    </div>
  );
}

function Term({ children }: { children: string }) {
  return (
    <dt>
      <InlineCode>{children}</InlineCode>
    </dt>
  );
}

function Notes({ children }: { children: ReactNode }) {
  return <ul className="ml-4 flex list-disc flex-col gap-1 text-sm text-fg-secondary marker:text-fg-placeholder">{children}</ul>;
}

function LiveAccess({ ctx }: { ctx: DevContext }) {
  const account = ctx.firstAccount;
  const plan = useQuery({
    queryKey: [...keys.account(ctx.appId, account?.id ?? ""), "plan"],
    queryFn: () => api.accounts.plan(ctx.appId, account!.id),
    enabled: Boolean(account),
    retry: false,
  });

  if (!account) {
    return (
      <Callout title="No accounts yet">
        Create one (from your app or the <Link href={`/apps/${ctx.appId}/accounts`}>Accounts</Link> page) to see a live
        response here.
      </Callout>
    );
  }
  if (plan.isLoading) return <Skeleton className="h-60" />;
  if (plan.error) {
    return (
      <Callout tone="danger" title={`Couldn't resolve ${account.name || account.id}'s access`}>
        {plan.error.message}
      </Callout>
    );
  }
  return (
    <CodeBlock
      lang="json"
      maxHeight={340}
      title={
        <span>
          Live response for <span className="text-fg">{account.name || account.id}</span>
          {account.name ? <span className="ml-1.5 font-mono text-fg-placeholder">{account.id}</span> : null}
        </span>
      }
      code={JSON.stringify(plan.data, null, 2)}
    />
  );
}

function LivePricing({ ctx }: { ctx: DevContext }) {
  const pricing = useQuery({
    queryKey: [...keys.plans(ctx.appId), "pricing"],
    queryFn: () => api.plans.pricing(ctx.appId),
  });
  if (pricing.isLoading) return <Skeleton className="h-40" />;
  if (pricing.error) {
    return (
      <Callout tone="danger" title="Couldn't load pricing cards">
        {pricing.error.message}
      </Callout>
    );
  }
  if (!pricing.data?.length) {
    return (
      <Callout title="No pricing cards yet">
        This endpoint returns an empty list until a plan has a pricing card. Add one from a plan&apos;s Pricing tab on the{" "}
        <Link href={`/apps/${ctx.appId}/plans`}>Plans</Link> page.
      </Callout>
    );
  }
  return (
    <CodeBlock
      lang="json"
      maxHeight={320}
      title={`Live response · ${pluralize(pricing.data.length, "pricing card")}`}
      code={JSON.stringify(pricing.data, null, 2)}
    />
  );
}

const PROMPT_CHIPS: { key: keyof PromptOptions; label: string }[] = [
  { key: "catalog", label: "Catalog" },
  { key: "reactHook", label: "React hook" },
  { key: "usage", label: "Usage tracking" },
  { key: "webhooks", label: "Billing webhooks" },
];

const SKILL_CHIPS: { key: "checkout" | "cancel"; label: string }[] = [
  { key: "checkout", label: "Checkout" },
  { key: "cancel", label: "Cancel flow" },
];

function SkillBuilder({ s, files }: { s: snippets.SnippetContext; files: SdkFile[] | null }) {
  const [opts, setOpts] = useState<SdkSkillOptions>({ checkout: true, cancel: true, publicKey: false });
  const { copied, copy } = useCopy();
  const set = (key: keyof SdkSkillOptions) => (value: boolean) => setOpts((o) => ({ ...o, [key]: value }));

  const skill = useMemo(
    () =>
      files
        ? buildSdkSkill(
            {
              baseUrl: s.baseUrl,
              appId: s.appId,
              appName: s.appName,
              publicKey: s.publicKey,
              files,
              examples: { flag: s.flag, usageEntitlement: s.ex.usageEntitlement },
            },
            opts,
          )
        : null,
    [s, files, opts],
  );

  if (!files || !skill) {
    return (
      <Callout tone="danger" title="Couldn't read the SDK source">
        The dashboard reads it from <InlineCode>src/sdk</InlineCode> on its server, and that folder wasn&apos;t there.
      </Callout>
    );
  }

  const fileCount = sdkFilesFor(files, opts).length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {SKILL_CHIPS.map((c) => (
          <ToggleChip key={c.key} pressed={opts[c.key]} onPressedChange={set(c.key)}>
            {c.label}
          </ToggleChip>
        ))}
        <ToggleChip pressed={opts.publicKey} onPressedChange={set("publicKey")}>
          Include publishable key
        </ToggleChip>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => downloadText("SKILL.md", skill)}>
            <Download />
            Download
          </Button>
          <Button variant="primary" onClick={() => copy(skill)}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy skill"}
          </Button>
        </div>
      </div>
      <Notes>
        <li>
          Claude Code: save it as <InlineCode>{SKILL_PATH}</InlineCode> in your repo, then ask it to install the Offer SDK.
        </li>
        <li>Cursor, Copilot and other agents: paste it into the chat, or save it in the repo and point the agent at it.</li>
        <li>
          Entitlement checks are always included. The skill carries {pluralize(fileCount, "SDK file")} (
          {Math.round(new Blob([skill]).size / 1024)} KB).
        </li>
      </Notes>
      <CodeBlock code={skill} lang="text" maxHeight={420} wrap />
    </>
  );
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function PromptBuilder({ ctx, s }: { ctx: DevContext; s: snippets.SnippetContext }) {
  const [opts, setOpts] = useState<PromptOptions>({
    catalog: true,
    reactHook: true,
    usage: true,
    webhooks: false,
    realKeys: false,
  });
  const { copied, copy } = useCopy();
  const set = (key: keyof PromptOptions) => (value: boolean) => setOpts((o) => ({ ...o, [key]: value }));

  const prompt = useMemo(
    () =>
      buildPrompt(
        {
          baseUrl: s.baseUrl,
          appId: s.appId,
          appName: s.appName,
          secretKey: s.secretKey,
          publicKey: s.publicKey,
          entitlements: ctx.entitlements,
          plans: ctx.plans,
          incentives: ctx.incentives,
          addons: ctx.addons,
          examples: { ...ctx.examples, flag: s.flag },
        },
        opts,
      ),
    [s, ctx.entitlements, ctx.plans, ctx.incentives, ctx.addons, ctx.examples, opts],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {PROMPT_CHIPS.map((c) => (
          <ToggleChip key={c.key} pressed={opts[c.key]} onPressedChange={set(c.key)}>
            {c.label}
          </ToggleChip>
        ))}
        <ToggleChip pressed={opts.realKeys} onPressedChange={set("realKeys")} tone="warning">
          Include real keys
        </ToggleChip>
        <Button variant="primary" className="ml-auto" onClick={() => copy(prompt)}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy prompt"}
        </Button>
      </div>
      {opts.realKeys ? (
        <Callout tone="warning" title="This prompt contains your secret key">
          Only paste it into tools you trust with full access to {s.appName}. Leave this off to have the assistant read keys from
          environment variables.
        </Callout>
      ) : null}
      <CodeBlock code={prompt} lang="text" maxHeight={420} wrap />
    </>
  );
}
