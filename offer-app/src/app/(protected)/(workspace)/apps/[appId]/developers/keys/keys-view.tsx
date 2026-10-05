"use client";

import { Braces, Check, Code, Key, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CopyField, InlineCode } from "@/components/developers/bits";
import { Callout } from "@/components/ui/callout";
import { ENV } from "@/components/developers/snippets";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Property, PropertyList } from "@/components/ui/property-list";
import { SecretInput } from "@/components/ui/secret-input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { keys, useApiMutation, useApp, useAppId, useWorkspace } from "@/lib/api/hooks";
import type { App } from "@/lib/api/types";

export function KeysView() {
  const appId = useAppId();
  const { data: app, isLoading, error } = useApp(appId);

  return (
    <>
      <PageHeader icon={<Key />} title="API keys" />
      <PageBody width="narrow">
        <PageTitle
          title="API keys"
          description={
            <>
              Your product authenticates to the Offer API with these keys, sent as{" "}
              <InlineCode>Authorization: Bearer &lt;key&gt;</InlineCode>.
            </>
          }
        />
        {isLoading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
        ) : error || !app ? (
          <Callout tone="danger" title="Couldn't load this app's keys">
            {error?.message}
          </Callout>
        ) : (
          <div>
            <KeySection kind="secret" app={app} />
            <KeySection kind="public" app={app} />
            <Capabilities />
            <Connection appId={appId} />
          </div>
        )}
      </PageBody>
    </>
  );
}

const COPY = {
  secret: {
    title: "Secret key",
    description: "Full access to every route for this app. Use it from your server only.",
    hint: (
      <>
        Store it as <InlineCode>{ENV.secret}</InlineCode> in your server environment. Never ship it in browser or mobile code.
      </>
    ),
    confirm:
      "The current secret key stops working immediately. Every server still using it gets 401 errors until you update OFFER_SECRET_KEY and redeploy.",
    done: "The previous key no longer works. Update OFFER_SECRET_KEY on your servers and redeploy.",
  },
  public: {
    title: "Public key",
    description: "Safe to ship in browser and mobile code: reads plans and pricing, and tracks usage.",
    hint: (
      <>
        Expose it to client code, e.g. as <InlineCode>{ENV.public}</InlineCode>.
      </>
    ),
    confirm:
      "The current public key stops working immediately. Browsers and apps still using it get 401 errors until you ship the new key.",
    done: "The previous key no longer works. Update the key in your client code and redeploy.",
  },
};

function KeySection({ kind, app }: { kind: "secret" | "public"; app: App }) {
  const confirm = useConfirm();
  const copy = COPY[kind];
  const [fresh, setFresh] = useState<string | null>(null);
  const current = kind === "secret" ? app.api_key : app.public_key;

  const regenerate = useApiMutation(
    async () =>
      kind === "secret"
        ? (await api.apps.regenerateKey(app.id)).api_key
        : (await api.apps.regeneratePublicKey(app.id)).public_key,
    {
      success: `${copy.title} regenerated`,
      invalidate: [[...keys.app(app.id), "detail"], keys.apps],
      onSuccess: (key) => setFresh(key),
    },
  );

  const onRegenerate = () =>
    confirm({
      title: `Regenerate the ${copy.title.toLowerCase()}?`,
      description: copy.confirm,
      typeToConfirm: app.name,
      confirmLabel: "Regenerate key",
      onConfirm: () => regenerate.mutateAsync(),
    });

  return (
    <Section
      title={copy.title}
      description={copy.description}
      actions={
        <Button onClick={onRegenerate} loading={regenerate.isPending}>
          {regenerate.isPending ? null : <RefreshCw />}
          Regenerate
        </Button>
      }
    >
      {fresh ? (
        <div className="flex flex-col gap-3">
          <SecretInput key={fresh} value={fresh} masked={false} />
          <Callout tone="warning" title={`New ${copy.title.toLowerCase()} created`}>
            <div className="flex items-end justify-between gap-3">
              <span>{copy.done} Copy it now.</span>
              <Button size="xs" variant="secondary" onClick={() => setFresh(null)}>
                Done
              </Button>
            </div>
          </Callout>
        </div>
      ) : (
        <>
          <SecretInput key={current} value={current} />
          <p className="mt-2 text-xs text-fg-tertiary">{copy.hint}</p>
        </>
      )}
    </Section>
  );
}

const yes = <Check className="mx-auto size-4 text-success" aria-label="Allowed" />;
const no = <EmptyCell />;

function Caveat({ tip }: { tip: string }) {
  return (
    <Tooltip content={<span className="block max-w-60">{tip}</span>}>
      <span className="mx-auto flex w-fit items-center gap-1 text-warning-fg" aria-label={`Allowed. ${tip}`}>
        <Check className="size-4" />
        <TriangleAlert className="size-3.5" />
      </span>
    </Tooltip>
  );
}

const CAPABILITIES: { label: string; route: string; secret: ReactNode; public: ReactNode }[] = [
  { label: "Read an account's access", route: "GET …/namespaces/:id/plan", secret: yes, public: yes },
  { label: "Read pricing cards", route: "GET …/plans/pricing", secret: yes, public: yes },
  {
    label: "Track usage",
    route: "…/namespaces/:id/usage/*",
    secret: yes,
    public: <Caveat tip="Any amount, including negative ones. Track billable usage from your server." />,
  },
  {
    label: "Read private plan meta",
    route: "GET …/namespaces/:id/full-plan",
    secret: yes,
    public: <Caveat tip="Known issue: the hosted API allows this with the public key." />,
  },
  { label: "Create, update and delete accounts", route: "…/namespaces", secret: yes, public: no },
  { label: "Manage plans, entitlements, add-ons, incentives", route: "…/plans, …/entitlements, …", secret: yes, public: no },
  { label: "Read analytics", route: "GET …/analytics", secret: yes, public: no },
  { label: "Update or delete the app, regenerate keys", route: "/apps/:appId", secret: yes, public: no },
];

function Capabilities() {
  return (
    <Section title="What each key can do">
      <div className="overflow-hidden rounded-lg border border-border [&_tbody_tr:last-child>td]:border-b-0">
        <Table>
          <THead className="static bg-bg-subtle">
            <tr>
              <TH className="h-8 text-xs">Capability</TH>
              <TH className="h-8 w-24 text-xs" align="center">
                Secret
              </TH>
              <TH className="h-8 w-24 text-xs" align="center">
                Public
              </TH>
            </tr>
          </THead>
          <TBody>
            {CAPABILITIES.map((c) => (
              <tr key={c.label}>
                <TD className="h-auto py-2">
                  <div className="text-fg">{c.label}</div>
                  <code className="text-[12.5px] text-fg-tertiary">{c.route}</code>
                </TD>
                <TD align="center">{c.secret}</TD>
                <TD align="center">{c.public}</TD>
              </tr>
            ))}
          </TBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-fg-tertiary">
        Known issue: the hosted API currently lets the public key read <InlineCode>/full-plan</InlineCode>, which includes
        private plan meta, and write usage with any amount. Until that&apos;s fixed, keep real secrets out of plan meta and
        track anything you bill on from your server.
      </p>
    </Section>
  );
}

function Connection({ appId }: { appId: string }) {
  const { data: workspace, isLoading } = useWorkspace();
  return (
    <Section
      title="Connection"
      description="Where your product sends its requests."
      actions={
        <>
          <Link href={`/apps/${appId}/developers`} className={buttonVariants({ variant: "ghost" })}>
            <Code />
            Integration guide
          </Link>
          <Link href={`/apps/${appId}/developers/api`} className={buttonVariants({ variant: "ghost" })}>
            <Braces />
            API reference
          </Link>
        </>
      }
    >
      <PropertyList>
        <Property label="Base URL">
          {isLoading ? <Skeleton className="h-8" /> : <CopyField value={workspace?.apiBaseUrl ?? ""} />}
        </Property>
        <Property label="App ID">
          <CopyField value={appId} />
        </Property>
        <Property label="API">
          {workspace?.mode === "remote" ? (
            <Badge color="green" dot>
              Hosted API
            </Badge>
          ) : workspace?.mode === "mock" ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge color="orange" dot>
                Mock API (in-memory)
              </Badge>
              <span className="text-xs text-fg-tertiary">Served by this dashboard. Data resets when the server restarts.</span>
            </span>
          ) : (
            <Skeleton className="h-5 w-32" />
          )}
        </Property>
      </PropertyList>
    </Section>
  );
}
