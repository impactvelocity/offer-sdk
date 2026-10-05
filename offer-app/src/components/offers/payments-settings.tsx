"use client";

import { CircleCheck, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { keys, useApiMutation, usePaypal } from "@/lib/api/hooks";
import type { App } from "@/lib/api/types";
import { formatDate } from "@/lib/utils";

/** App settings → Payments: the app's PayPal REST app and its own checkout page. */
export function PaymentsSettings({ app }: { app: App }) {
  const { data: paypal, isLoading, error } = usePaypal(app.id);
  const ref = useRef<HTMLDivElement>(null);
  // Links to #payments arrive before this section exists; scroll once it has loaded.
  const loaded = !!paypal;
  useEffect(() => {
    if (loaded && window.location.hash === "#payments") ref.current?.scrollIntoView({ block: "start" });
  }, [loaded]);
  // The in-memory mock has no payments.
  if (error) return null;

  return (
    <div id="payments" ref={ref} className="scroll-mt-8">
      <Section
        title="Payments"
        description="Offers are paid with PayPal using your own PayPal REST app. Buyers pay you directly."
      >
        <div className="flex flex-col gap-6">
          {isLoading || !paypal ? <Skeleton className="h-24" /> : paypal.connected ? <Connected app={app} paypal={paypal} /> : <ConnectForm appId={app.id} />}
          <CheckoutUrl key={app.checkout_url ?? ""} app={app} />
        </div>
      </Section>
    </div>
  );
}

function Connected({ app, paypal }: { app: App; paypal: NonNullable<ReturnType<typeof usePaypal>["data"]> }) {
  const confirm = useConfirm();
  const [replacing, setReplacing] = useState(false);
  const disconnect = useApiMutation(() => api.paypal.disconnect(app.id), {
    success: "PayPal disconnected",
    invalidate: [keys.paypal(app.id), keys.offers(app.id)],
  });

  if (replacing) return <ConnectForm appId={app.id} onDone={() => setReplacing(false)} />;

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-5 py-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-fg">
          <CircleCheck className="size-4 text-success" />
          PayPal connected
          <Badge color={paypal.env === "live" ? "green" : "yellow"}>{paypal.env === "live" ? "Live" : "Sandbox"}</Badge>
        </p>
        <p className="mt-1 truncate text-xs text-fg-tertiary">
          Client ID <code>{paypal.client_id}</code> · since {formatDate(paypal.updated_at)}
        </p>
        <p className="mt-1 text-xs text-fg-tertiary">
          {paypal.webhook === "registered"
            ? "Webhooks registered: renewals and cancellations update accounts automatically."
            : "Webhooks aren't registered (the API isn't on a public HTTPS address), so checkouts complete when the buyer returns to your page."}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => setReplacing(true)}>
          Replace
        </Button>
        <Button
          size="sm"
          variant="danger-ghost"
          onClick={() =>
            confirm({
              title: "Disconnect PayPal?",
              description: "New checkouts stop working. Existing PayPal subscriptions keep billing, but their renewals and cancellations stop reaching this app.",
              tone: "danger",
              confirmLabel: "Disconnect",
              onConfirm: () => disconnect.mutateAsync(),
            })
          }
        >
          <Unplug />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

function ConnectForm({ appId, onDone }: { appId: string; onDone?: () => void }) {
  const [env, setEnv] = useState<"sandbox" | "live">("sandbox");
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const connect = useApiMutation(() => api.paypal.connect(appId, { client_id: clientId.trim(), client_secret: secret.trim(), env }), {
    success: "PayPal connected",
    invalidate: [keys.paypal(appId), keys.offers(appId)],
    toastError: false,
    onSuccess: () => onDone?.(),
  });

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-border px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (clientId.trim() && secret.trim()) connect.mutate();
      }}
    >
      <Segmented
        value={env}
        onValueChange={setEnv}
        options={[
          { value: "sandbox", label: "Sandbox" },
          { value: "live", label: "Live" },
        ]}
      />
      <Field label="Client ID" description="From your REST app at developer.paypal.com → Apps & Credentials.">
        <Input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" className="font-mono text-[13px]" />
      </Field>
      <Field label="Secret" description="Checked with PayPal, then stored encrypted. It's never shown again." error={connect.error?.message}>
        <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" className="font-mono text-[13px]" />
      </Field>
      <div className="flex justify-end gap-2">
        {onDone ? <Button onClick={onDone}>Cancel</Button> : null}
        <Button type="submit" variant="primary" loading={connect.isPending} disabled={!clientId.trim() || !secret.trim()}>
          Connect PayPal
        </Button>
      </div>
    </form>
  );
}

function CheckoutUrl({ app }: { app: App }) {
  const [url, setUrl] = useState(app.checkout_url ?? "");
  const trimmed = url.trim();
  const valid = !trimmed || /^https?:\/\/\S+$/.test(trimmed);
  const save = useApiMutation(() => api.apps.update(app.id, { checkout_url: trimmed || null }), {
    success: "Checkout page saved",
    invalidate: [keys.app(app.id)],
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate();
      }}
    >
      <Field
        label="Checkout page"
        hint="(optional)"
        description="Your page with the checkout SDK. Offer links and over-limit upgrade links send buyers here with ?offer=…"
        error={valid ? undefined : "Enter a full http(s) URL"}
      >
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourapp.com/checkout" />
          <Button type="submit" variant="primary" size="md" disabled={!valid || trimmed === (app.checkout_url ?? "")} loading={save.isPending}>
            Save
          </Button>
        </div>
      </Field>
    </form>
  );
}
