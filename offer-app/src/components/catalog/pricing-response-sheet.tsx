"use client";

import { useQuery } from "@tanstack/react-query";
import { Braces } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CodeBlock } from "@/components/ui/code-block";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import { keys, useApp, useWorkspace } from "@/lib/api/hooks";
import type { Plan } from "@/lib/api/types";

const mask = (key: string) => `${key.slice(0, 8)}${"•".repeat(12)}${key.slice(-4)}`;

/** Button + drawer showing this plan's entry in GET /plans/pricing, exactly as the API returns it. */
export function PricingResponseSheet({ appId, plan, dirty }: { appId: string; plan: Plan; dirty: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: app } = useApp(appId);
  const { data: workspace } = useWorkspace();
  const pricing = useQuery({
    queryKey: [...keys.app(appId), "pricing"],
    queryFn: () => api.plans.pricing(appId),
    enabled: open,
    retry: false,
  });

  const entry = pricing.data?.find((p) => p.plan_id === plan.id);
  const path = `/apps/${encodeURIComponent(appId)}/plans/pricing`;
  const curlWith = (k: string) => `curl ${workspace?.apiBaseUrl ?? ""}${path} \\\n  -H "Authorization: Bearer ${k}"`;
  const status = pricing.error instanceof ApiError ? pricing.error.status : pricing.data ? 200 : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Braces />
        View API response
      </Button>
      <SheetContent>
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm font-semibold text-fg">API response</SheetTitle>
            <SheetDescription className="mt-0.5 text-sm text-fg-tertiary">
              {plan.name}&apos;s entry in <code className="text-fg-secondary">GET /plans/pricing</code>, so your pricing page
              renders from the API instead of hard-coded copy.
            </SheetDescription>
          </div>
          <SheetCloseButton className="-mr-1.5 -mt-0.5" />
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 scrollbar-thin">
          <CodeBlock
            lang="bash"
            code={curlWith(app?.public_key ? mask(app.public_key) : "<public key>")}
            copyValue={app?.public_key ? curlWith(app.public_key) : undefined}
            title="Public key · safe in the browser"
          />
          {dirty && plan.pricingCard ? (
            <Callout tone="warning">Showing the published card. Save your changes to update the response.</Callout>
          ) : null}
          {pricing.isLoading ? (
            <Skeleton className="h-64" />
          ) : pricing.data && !entry ? (
            <Callout title="Not in the response yet">
              {plan.name} has no published pricing card, so it&apos;s left out of <code>GET /plans/pricing</code>.
            </Callout>
          ) : (
            <CodeBlock
              lang="json"
              code={JSON.stringify(pricing.error ? { error: pricing.error.message } : entry, null, 2)}
              title={
                <span className="flex items-center gap-2">
                  Response · {plan.name}
                  {status ? <Badge color={status === 200 ? "green" : "red"}>{status === 200 ? "200 OK" : status}</Badge> : null}
                </span>
              }
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
