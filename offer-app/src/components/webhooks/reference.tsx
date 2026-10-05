"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { InlineCode, Md } from "@/components/developers/bits";
import { Section } from "@/components/ui/card";
import { CodeBlock, CodeTabs } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
import { sampleEventData, WEBHOOK_CATEGORIES, WEBHOOK_EVENTS, type WebhookEventType } from "@/lib/webhooks/catalog";

export const WEBHOOK_SECRET_ENV = "OFFER_WEBHOOK_SECRET";

/** A full sample payload, as delivered. */
export function samplePayload(type: WebhookEventType, appId: string) {
  return {
    id: "evt_Kq3mXbT9wLcN2pRfYs8dHjAe",
    type,
    created_at: "2026-10-01T12:00:00.000Z",
    app_id: appId,
    data: sampleEventData(type, appId),
  };
}

const NODE = `import crypto from "node:crypto";

// Verifies a delivery (Standard Webhooks). Pass the raw request body, not parsed JSON.
export function verifyOfferWebhook(body: string, headers: Headers, secret = process.env.${WEBHOOK_SECRET_ENV}!) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature") ?? "";
  if (!id || !timestamp) return false;

  // Reject anything older than 5 minutes to stop replays.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(\`\${id}.\${timestamp}.\${body}\`).digest("base64");

  return signatures.split(" ").some((entry) => {
    const signature = entry.split(",")[1] ?? "";
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  });
}`;

const NEXT = `// app/api/webhooks/offer/route.ts
import { verifyOfferWebhook } from "@/lib/verify-offer-webhook";

export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyOfferWebhook(body, req.headers)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(body);
  switch (event.type) {
    case "account.plan_changed":
      // event.data.object is the account; event.data.previous.plan is the old plan
      break;
    case "usage.limit_reached":
      // event.data.object: { account_id, entitlement_id, usage, max, ... }
      break;
  }

  // Answer quickly with a 2xx; anything else is retried.
  return new Response(null, { status: 204 });
}`;

const LIBRARY = `// npm install standardwebhooks
import { Webhook } from "standardwebhooks";

const wh = new Webhook(process.env.${WEBHOOK_SECRET_ENV}!);

// Throws if the signature or timestamp is invalid.
const event = wh.verify(rawBody, {
  "webhook-id": req.headers.get("webhook-id")!,
  "webhook-timestamp": req.headers.get("webhook-timestamp")!,
  "webhook-signature": req.headers.get("webhook-signature")!,
});`;

export function VerifySignatures() {
  return (
    <Section
      title="Verify signatures"
      description={
        <>
          Every request is signed with the endpoint&apos;s secret following{" "}
          <a href="https://www.standardwebhooks.com" target="_blank" rel="noreferrer" className="text-accent-fg hover:underline">
            Standard Webhooks
          </a>
          , so any Standard Webhooks library can verify it. Store the secret as <InlineCode>{WEBHOOK_SECRET_ENV}</InlineCode>.
        </>
      }
    >
      <CodeTabs
        tabs={[
          { label: "Node.js", code: NODE },
          { label: "Next.js route", code: NEXT },
          { label: "standardwebhooks", code: LIBRARY },
        ]}
      />
    </Section>
  );
}

const HEADERS: [string, string][] = [
  ["webhook-id", "The event ID. Same on every retry, so use it to skip duplicates."],
  ["webhook-timestamp", "Unix seconds when this attempt was sent."],
  ["webhook-signature", "`v1,<base64 HMAC-SHA256>` of `id.timestamp.body`, keyed by the secret."],
  ["User-Agent", "`OfferSDK-Webhooks/1.0`"],
];

export function DeliveryRules() {
  return (
    <Section title="How delivery works">
      <div className="flex flex-col gap-5 text-sm text-fg-secondary">
        <div className="overflow-hidden rounded-lg border border-border">
          {HEADERS.map(([name, text]) => (
            <div key={name} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
              <code className="text-[13px] text-fg">{name}</code>
              <span>
                <Md>{text}</Md>
              </span>
            </div>
          ))}
        </div>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Any 2xx response within 10 seconds counts as delivered. Redirects aren&apos;t followed.</li>
          <li>
            Failed deliveries are retried after 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours and 24 hours, then marked
            failed. You can retry any delivery by hand from the endpoint&apos;s log.
          </li>
          <li>
            Answering <InlineCode>410 Gone</InlineCode> turns the endpoint off. Zapier does this when a Zap is deleted.
          </li>
          <li>Events can arrive out of order or more than once. Order by <InlineCode>created_at</InlineCode> and dedupe on the event ID.</li>
        </ul>
      </div>
    </Section>
  );
}

export function EventReference({ appId }: { appId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section
      title="Event types"
      description={<Md>Every payload has the same envelope. `data.object` is the resource after the change.</Md>}
    >
      <div className="flex flex-col gap-6">
        {WEBHOOK_CATEGORIES.map((category) => (
          <div key={category.id}>
            <h3 className="mb-2 text-sm font-semibold text-fg">{category.title}</h3>
            <div className="overflow-hidden rounded-lg border border-border">
              {WEBHOOK_EVENTS.filter((e) => e.category === category.id).map((e) => (
                <div key={e.type} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpen(open === e.type ? null : e.type)}
                    aria-expanded={open === e.type}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle"
                  >
                    <ChevronRight className={cn("mt-0.5 size-4 shrink-0 text-fg-icon transition-transform", open === e.type && "rotate-90")} />
                    <div className="min-w-0 flex-1">
                      <code className="text-[13.5px] font-medium text-fg">{e.type}</code>
                      <p className="mt-0.5 text-sm text-fg-tertiary">
                        <Md>{e.description}</Md>
                      </p>
                    </div>
                  </button>
                  {open === e.type ? (
                    <div className="border-t border-border bg-bg-subtle px-4 py-4">
                      <CodeBlock lang="json" code={JSON.stringify(samplePayload(e.type, appId), null, 2)} className="bg-bg" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
