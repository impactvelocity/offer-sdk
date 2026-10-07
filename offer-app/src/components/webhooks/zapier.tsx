"use client";

import { ArrowRight, ArrowUpRight, CircleCheck, CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Md } from "@/components/developers/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/hooks";
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { WEBHOOK_CATEGORIES, WEBHOOK_EVENTS, type WebhookEventType } from "@/lib/webhooks/catalog";
import { eventTitle, ZapierMark } from "./bits";
import { urlProblem } from "./endpoint-dialog";

const ZAPIER_EDITOR = "https://zapier.com/app/editor";

export const ZAPIER_RECIPES: { title: string; event: WebhookEventType }[] = [
  { title: "Post to Slack when an account changes plan", event: "account.plan_changed" },
  { title: "Email a customer who hits a usage limit", event: "usage.limit_reached" },
  { title: "Add new accounts to your CRM", event: "account.created" },
  { title: "Alert sales when usage nears a limit", event: "usage.limit_warning" },
];

const isZapierHook = (value: string) => {
  try {
    return new URL(value).hostname.endsWith("zapier.com");
  } catch {
    return false;
  }
};

/** Branded promo with one-click recipes. Each recipe opens the connect dialog on its event. */
export function ZapierCard({ onConnect, className }: { onConnect: (event?: WebhookEventType) => void; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-bg shadow-xs", className)}>
      <div className="flex flex-col gap-4 bg-[linear-gradient(135deg,var(--zapier-subtle),transparent_60%)] p-5 sm:flex-row sm:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-bg shadow-xs">
          <ZapierMark className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold text-fg">Automate with Zapier</h3>
          <p className="mt-0.5 text-sm text-fg-tertiary">
            Send Offer events to 7,000+ apps without writing code. Every Zap is a signed webhook under the hood, with the same
            retries and delivery log.
          </p>
        </div>
        <Button variant="secondary" onClick={() => onConnect()} className="shrink-0">
          <ZapierMark />
          Connect Zapier
        </Button>
      </div>
      <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
        {ZAPIER_RECIPES.map((r) => (
          <button
            key={r.event}
            type="button"
            onClick={() => onConnect(r.event)}
            className="group flex items-center gap-3 bg-bg px-5 py-3 text-left outline-none transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-fg">{r.title}</div>
              <code className="text-xs text-fg-tertiary">{r.event}</code>
            </div>
            <ArrowRight className="size-4 shrink-0 text-fg-icon transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-zapier-subtle text-xs font-semibold tabular text-zapier">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="text-sm font-medium text-fg">{title}</div>
        {children}
      </div>
    </div>
  );
}

const eventOptions = WEBHOOK_CATEGORIES.flatMap((c) =>
  WEBHOOK_EVENTS.filter((e) => e.category === c.id).map((e) => ({
    value: e.type,
    label: e.title,
    description: e.type,
  })),
);

/** Guided setup: a "Catch Hook" URL from Zapier becomes a webhook endpoint, then we send a sample. */
export function ZapierConnectDialog({
  open,
  onOpenChange,
  appId,
  initialEvent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  initialEvent?: WebhookEventType;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <ZapierForm appId={appId} initialEvent={initialEvent} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ZapierForm({ appId, initialEvent, onClose }: { appId: string; initialEvent?: WebhookEventType; onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [event, setEvent] = useState<WebhookEventType>(initialEvent ?? "account.created");
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<{ endpoint: WebhookEndpoint; delivery: WebhookDelivery | null } | null>(null);

  const problem = urlProblem(url);
  const notZapier = !problem && url.trim() !== "" && !isZapierHook(url.trim());

  const connect = useApiMutation(
    async () => {
      const endpoint = await api.webhooks.create(appId, {
        url: url.trim(),
        events: [event],
        source: "zapier",
        description: `Zapier · ${eventTitle(event)}`,
      });
      // Zapier's "Test trigger" needs a sample request to learn the fields.
      const delivery = await api.webhooks.test(appId, endpoint.id, event).catch(() => null);
      return { endpoint, delivery };
    },
    { onSuccess: setResult },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (url.trim() && !problem) connect.mutate();
  };

  if (result) {
    const ok = result.delivery?.status === "succeeded";
    return (
      <>
        <DialogHeader icon={<ZapierMark />} title="Zapier connected" />
        <DialogBody>
          <div className="flex gap-3">
            {ok ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" /> : <CircleX className="mt-0.5 size-5 shrink-0 text-danger" />}
            <div className="text-sm text-fg-secondary">
              {ok ? (
                <>
                  We sent a sample <span className="font-medium text-fg">{eventTitle(event)}</span> event to your Zap. Back in
                  Zapier, click <span className="font-medium text-fg">Test trigger</span> to pull it in and map its fields.
                </>
              ) : (
                <>
                  The endpoint is saved, but the sample didn&apos;t go through
                  {result.delivery?.response_status ? ` (HTTP ${result.delivery.response_status})` : ""}. Check the URL is the
                  Catch Hook URL from your Zap, then send another test from the endpoint page.
                </>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={() => {
              onClose();
              router.push(`/apps/${appId}/developers/webhooks/${result.endpoint.id}`);
            }}
          >
            View Endpoint
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader icon={<ZapierMark />} title="Connect to Zapier" />
      <DialogBody className="gap-6">
        <Step n={1} title={<>In Zapier, start a Zap with <b>Webhooks by Zapier</b> → <b>Catch Hook</b></>}>
          <p className="text-sm text-fg-tertiary">Leave &ldquo;Pick off a child key&rdquo; empty, then copy the webhook URL Zapier shows you.</p>
          <a href={ZAPIER_EDITOR} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
            Open Zapier
            <ArrowUpRight />
          </a>
        </Step>
        <Step n={2} title="Paste the Catch Hook URL">
          <Field
            error={touched ? problem : null}
            description={notZapier ? "This doesn't look like a Zapier URL. It will still work as a regular webhook." : undefined}
          >
            <Input
              autoFocus
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="https://hooks.zapier.com/hooks/catch/123456/abcdef/"
              className="font-mono text-[13.5px]"
            />
          </Field>
        </Step>
        <Step n={3} title="Choose what triggers the Zap">
          <Select value={event} onValueChange={setEvent} options={eventOptions} aria-label="Trigger event" />
          <p className="text-sm text-fg-tertiary">
            <Md>{WEBHOOK_EVENTS.find((e) => e.type === event)?.description ?? ""}</Md> We&apos;ll send a sample right away so
            Zapier can see the fields.
          </p>
        </Step>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} kbd="Esc">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={connect.isPending} disabled={!url.trim() || Boolean(problem)} kbd="↵">
          Connect and Send Sample
        </Button>
      </DialogFooter>
    </form>
  );
}
