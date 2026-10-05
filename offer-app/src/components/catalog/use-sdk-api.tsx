"use client";

import { Braces, Code, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { InlineCode, Md } from "@/components/developers/bits";
import { EndpointRow } from "@/components/developers/endpoint-row";
import { ENDPOINTS, endpointId, GROUPS, type Endpoint, type GroupId } from "@/components/developers/endpoints";
import * as snippets from "@/components/developers/snippets";
import { useDevContext } from "@/components/developers/use-dev-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CodeBlock, CodeTabs } from "@/components/ui/code-block";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { HowItWorksTopic } from "./how-it-works";

type Topic = HowItWorksTopic;

const NAMES: Record<Topic, string> = { plans: "plans", entitlements: "entitlements", addons: "add-ons", incentives: "incentives" };

const NS = "/apps/:appId/namespaces/:namespaceId";

/** API groups per catalog page, plus the account endpoints that put accounts on a plan or incentive. */
const API: Record<Topic, { groups: GroupId[]; extra?: Pick<Endpoint, "method" | "path">[] }> = {
  plans: { groups: ["plans", "pricing"], extra: [{ method: "PATCH", path: NS }] },
  entitlements: { groups: ["entitlements", "access", "usage"] },
  addons: { groups: ["addons", "access"] },
  incentives: {
    groups: ["incentives"],
    extra: [
      { method: "PATCH", path: NS },
      { method: "DELETE", path: `${NS}/incentive` },
      { method: "GET", path: "/apps/:appId/namespaces/with-incentive" },
    ],
  },
};

/** "Use SDK" and "Use API" header buttons, each opening a drawer scoped to this catalog page. */
export function UseSdkApiButtons({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the drawer doesn't swap content mid-animation.
  const [kind, setKind] = useState<"sdk" | "api">("sdk");
  const show = (k: "sdk" | "api") => {
    setKind(k);
    setOpen(true);
  };
  return (
    <>
      <Button variant="ghost" onClick={() => show("sdk")}>
        <Code />
        <span className="hidden sm:inline">Use SDK</span>
      </Button>
      <Button variant="ghost" onClick={() => show("api")}>
        <Braces />
        <span className="hidden sm:inline">Use API</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-[720px]">
          {kind === "api" ? <ApiGuide topic={topic} /> : <SdkGuide topic={topic} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function DrawerHeader({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0 flex-1">
        <SheetTitle className="text-sm font-semibold text-fg">{title}</SheetTitle>
        <SheetDescription className="mt-0.5 text-sm text-fg-tertiary">{description}</SheetDescription>
      </div>
      <SheetCloseButton className="-mr-1.5 -mt-0.5" />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-fg">
        <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-fg">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function SdkGuide({ topic }: { topic: Topic }) {
  const ctx = useDevContext();
  const s = useMemo(() => snippets.toSnippetContext(ctx, false), [ctx]);
  const name = NAMES[topic];

  const examples = useMemo(() => {
    if (!s) return null;
    const ent = (id: string) => ctx.entitlements.find((e) => e.id === id);
    switch (topic) {
      case "plans":
        return snippets.planSdk(s);
      case "entitlements": {
        const usage = ent(s.ex.usageEntitlement);
        const flag = ent(s.flag);
        return [
          ...snippets
            .entitlementUsage(s, { id: s.ex.usageEntitlement, name: usage?.name ?? s.usageName, type: "usage" })
            .slice(0, 1)
            .map((t) => ({ ...t, label: "Usage limit" })),
          ...snippets
            .entitlementUsage(s, { id: s.flag, name: flag?.name ?? s.flag, type: "boolean" })
            .slice(0, 1)
            .map((t) => ({ ...t, label: "Feature flag" })),
        ];
      }
      case "addons": {
        const addon = ctx.addons.find((a) => a.id === s.ex.addon);
        return snippets.addonUsage(s, { id: s.ex.addon, name: addon?.name ?? s.ex.addon }).slice(0, 1);
      }
      case "incentives":
        return snippets.incentiveSdk(s);
    }
  }, [s, topic, ctx.entitlements, ctx.addons]);

  return (
    <>
      <DrawerHeader title="Use the SDK" description={`Read ${name} in your React app with the useOfferPlan hook.`} />
      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-5 scrollbar-thin">
        {!s || !examples ? (
          <Skeleton className="h-80" />
        ) : (
          <>
            <Step n={1} title="Add the hook">
              <p className="text-sm text-fg-tertiary">
                One file, no dependencies. Copy it into your app once; it fetches the account&apos;s resolved plan with your
                public key, so it&apos;s safe in the browser.
              </p>
              <CodeBlock lang="tsx" title="use-offer-plan.tsx" code={snippets.reactHook(s)[0].code} maxHeight={240} />
            </Step>
            <Step n={2} title={`Use it for ${name}`}>
              <CodeTabs tabs={examples} />
            </Step>
            <Callout>
              Client checks drive the UI. Repeat the check on your server before doing anything that costs you; see{" "}
              <span className="font-medium text-fg">Use API</span> or the{" "}
              <Link href={`/apps/${ctx.appId}/developers#check-access`} className="text-accent-fg hover:underline">
                integration guide
              </Link>
              .
            </Callout>
          </>
        )}
      </div>
    </>
  );
}

function ApiGuide({ topic }: { topic: Topic }) {
  const ctx = useDevContext();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const { groups, extra = [] } = API[topic];

  const sections = useMemo(() => {
    const extras = ENDPOINTS.filter((e) => extra.some((x) => x.method === e.method && x.path === e.path));
    return [
      ...groups.map((id) => ({ id, endpoints: ENDPOINTS.filter((e) => e.group === id) })),
      ...(extras.length ? [{ id: "accounts" as GroupId, endpoints: extras }] : []),
    ].map((g) => ({ ...g, group: GROUPS.find((x) => x.id === g.id)! }));
  }, [groups, extra]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <DrawerHeader
        title="Use the API"
        description={
          <>
            Manage {NAMES[topic]} from your server with the secret key. Endpoints marked public also accept the public key.
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
          <CodeBlock
            lang="bash"
            title="Authentication"
            code={`curl ${ctx.baseUrl}/apps/${ctx.appId}/... \\\n  -H "Authorization: Bearer $${snippets.ENV.secret}"`}
          />
          <p className="text-xs text-fg-tertiary">
            Base URL <InlineCode>{ctx.baseUrl || "…"}</InlineCode>. Expand an endpoint for parameters, examples and Try it.
          </p>
        </div>
        {ctx.isLoading ? (
          <Skeleton className="m-5 h-80" />
        ) : (
          sections.map(({ id, group, endpoints }) => (
            <section key={id}>
              <div className="border-b border-border bg-bg-subtle px-5 py-2.5">
                <h3 className="text-sm font-semibold text-fg">{group.title}</h3>
                <p className="text-xs text-fg-tertiary">
                  <Md>{group.description}</Md>
                </p>
              </div>
              {endpoints.map((e) => {
                const eid = endpointId(e);
                return <EndpointRow key={eid} endpoint={e} open={expanded.has(eid)} onToggle={() => toggle(eid)} ctx={ctx} />;
              })}
            </section>
          ))
        )}
        <div className="px-5 py-4">
          <Link href={`/apps/${ctx.appId}/developers/api`} className={buttonVariants({ size: "sm" })}>
            <ExternalLink />
            Full API reference
          </Link>
        </div>
      </div>
    </>
  );
}
