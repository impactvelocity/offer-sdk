"use client";

import { Webhook } from "lucide-react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { WebhookDelivery, WebhookDeliveryStatus, WebhookEndpoint } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ALL_EVENTS, WEBHOOK_EVENTS } from "@/lib/webhooks/catalog";

// Small pieces shared by the webhook pages.

const titles = new Map<string, string>(WEBHOOK_EVENTS.map((e) => [e.type, e.title]));

export const eventTitle = (type: string) => titles.get(type) ?? type;

/** Zapier's asterisk, drawn in its brand orange. */
export function ZapierMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden>
      <g fill="var(--zapier)">
        {[0, 45, 90, 135].map((deg) => (
          <rect key={deg} x="10.4" y="2" width="3.2" height="20" rx="1.6" transform={`rotate(${deg} 12 12)`} />
        ))}
      </g>
    </svg>
  );
}

/** Square tile for an endpoint: the Zapier mark or a generic webhook icon. */
export function EndpointIcon({ source, size = "sm" }: { source: WebhookEndpoint["source"]; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-12 rounded-xl" : "size-6 rounded-md";
  const icon = size === "lg" ? "size-6" : "size-3.5";
  return source === "zapier" ? (
    <span className={cn("flex shrink-0 items-center justify-center bg-zapier-subtle", box)}>
      <ZapierMark className={icon} />
    </span>
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center bg-tag-brand-bg text-tag-brand-fg", box)}>
      <Webhook className={icon} />
    </span>
  );
}

/** "hooks.zapier.com/hooks/catch/…" without the scheme. */
export function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

export function endpointName(endpoint: Pick<WebhookEndpoint, "description" | "url">) {
  if (endpoint.description) return endpoint.description;
  try {
    return new URL(endpoint.url).host;
  } catch {
    return endpoint.url;
  }
}

export function EndpointStatus({ endpoint }: { endpoint: WebhookEndpoint }) {
  if (!endpoint.enabled) {
    return endpoint.disabled_reason ? (
      <Tooltip content={endpoint.disabled_reason}>
        <span>
          <StatusDot color="red">Disabled</StatusDot>
        </span>
      </Tooltip>
    ) : (
      <StatusDot color="gray">Paused</StatusDot>
    );
  }
  if (endpoint.stats.last_status === "failed" || (endpoint.stats.last_status === "pending" && endpoint.stats.last_response_status)) {
    return <StatusDot color="orange">Failing</StatusDot>;
  }
  return <StatusDot color="green">Active</StatusDot>;
}

const deliveryTone: Record<WebhookDeliveryStatus, { color: "green" | "red" | "yellow"; label: string }> = {
  succeeded: { color: "green", label: "Delivered" },
  failed: { color: "red", label: "Failed" },
  pending: { color: "yellow", label: "Retrying" },
};

export function DeliveryStatusBadge({ delivery }: { delivery: Pick<WebhookDelivery, "status" | "attempts"> }) {
  const tone = deliveryTone[delivery.status];
  const label = delivery.status === "pending" && delivery.attempts === 0 ? "Sending" : tone.label;
  return (
    <Badge color={tone.color} dot>
      {label}
    </Badge>
  );
}

/** HTTP status code, colored by class. */
export function HttpStatus({ status }: { status: number | null }) {
  if (status === null) return <span className="text-fg-placeholder">—</span>;
  const ok = status >= 200 && status < 300;
  return <code className={cn("text-[13px] tabular", ok ? "text-success-fg" : "text-danger-fg")}>{status}</code>;
}

export function EventsSummary({ events }: { events: string[] }) {
  if (events.includes(ALL_EVENTS)) return <Badge color="brand">All events</Badge>;
  if (events.length === 1) return <code className="text-[13px] text-fg">{events[0]}</code>;
  return (
    <Tooltip
      content={
        <span className="flex flex-col gap-0.5">
          {events.map((e) => (
            <code key={e} className="text-xs">
              {e}
            </code>
          ))}
        </span>
      }
    >
      <span className="inline-flex items-center gap-1.5">
        <code className="text-[13px] text-fg">{events[0]}</code>
        <Badge color="gray">+{events.length - 1}</Badge>
      </span>
    </Tooltip>
  );
}

/** "98%" success over the last 7 days, or null when nothing was delivered. */
export function successRate(stats: WebhookEndpoint["stats"]) {
  const settled = stats.succeeded + stats.failed;
  return settled ? Math.round((stats.succeeded / settled) * 100) : null;
}
