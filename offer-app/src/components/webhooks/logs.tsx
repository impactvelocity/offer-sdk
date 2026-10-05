"use client";

import { ChevronRight, Clock, Hash, Inbox, RefreshCw, Send, Tag, Zap } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { keys, useApiMutation, useWebhookDeliveries, useWebhookEvents } from "@/lib/api/hooks";
import type { WebhookDelivery, WebhookDeliveryStatus, WebhookEventPayload } from "@/lib/api/types";
import { cn, formatDateTime, formatRelative, pluralize } from "@/lib/utils";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/catalog";
import { DeliveryStatusBadge, HttpStatus } from "./bits";

const json = (value: unknown) => JSON.stringify(value, null, 2);

function Expander({ open }: { open: boolean }) {
  return <ChevronRight className={cn("size-4 text-fg-icon transition-transform", open && "rotate-90")} />;
}

function When({ value }: { value: string }) {
  return (
    <Tooltip content={new Date(value).toLocaleString()}>
      <span className="whitespace-nowrap text-fg-secondary">{formatRelative(value)}</span>
    </Tooltip>
  );
}

/** What the event is about: an account id, a plan id… */
function subject(payload: WebhookEventPayload) {
  const object = payload.data.object as { id?: string; account_id?: string; entitlement_id?: string };
  if (object.account_id) return `${object.account_id} · ${object.entitlement_id}`;
  return object.id ?? null;
}

function Panel({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex h-6 items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-fg-tertiary">{title}</h4>
        {aside}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deliveries for one endpoint

type StatusFilter = "all" | WebhookDeliveryStatus;

export function DeliveryLog({ appId, endpointId }: { appId: string; endpointId: string }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const { data: deliveries, isLoading, error } = useWebhookDeliveries(appId, endpointId, status === "all" ? undefined : status);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-border px-8 py-3">
        <Segmented<StatusFilter>
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "succeeded", label: "Delivered" },
            { value: "pending", label: "Retrying" },
            { value: "failed", label: "Failed" },
          ]}
        />
        <span className="ml-auto flex items-center gap-1.5 text-xs text-fg-tertiary">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          Live
        </span>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2 p-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : error ? (
        <EmptyState compact icon={<Inbox />} title="Couldn't load deliveries" description={error.message} />
      ) : !deliveries?.length ? (
        <EmptyState
          compact
          icon={<Send />}
          title={status === "all" ? "No deliveries yet" : "Nothing here"}
          description={
            status === "all"
              ? "Deliveries show up as soon as a subscribed event happens. Send a test event to try it now."
              : "No deliveries with this status."
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 px-0" />
                  <TH icon={<Zap />}>Status</TH>
                  <TH icon={<Tag />} className="min-w-60">
                    Event
                  </TH>
                  <TH icon={<Hash />}>Response</TH>
                  <TH align="right">Attempts</TH>
                  <TH icon={<Clock />}>Time</TH>
                </tr>
              </THead>
              <TBody>
                {deliveries.map((d) => (
                  <Fragment key={d.id}>
                    <TR interactive onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                      <TD className="w-10 px-0 text-center">
                        <span className="inline-flex">
                          <Expander open={open === d.id} />
                        </span>
                      </TD>
                      <TD>
                        <DeliveryStatusBadge delivery={d} />
                      </TD>
                      <TD>
                        <span className="flex items-center gap-2">
                          <code className="truncate text-[13px] text-fg">{d.event_type}</code>
                          {d.test ? <Badge color="gray">Test</Badge> : null}
                        </span>
                      </TD>
                      <TD>
                        <span className="flex items-center gap-2">
                          <HttpStatus status={d.response_status} />
                          {d.duration_ms !== null ? <span className="text-xs tabular text-fg-tertiary">{d.duration_ms} ms</span> : null}
                          {d.response_status === null && d.error ? <span className="truncate text-xs text-danger-fg">{d.error}</span> : null}
                        </span>
                      </TD>
                      <TD align="right">{d.attempts}</TD>
                      <TD>
                        <When value={d.last_attempt_at ?? d.created_at} />
                      </TD>
                    </TR>
                    {open === d.id ? (
                      <tr>
                        <td colSpan={6} className="border-b border-border bg-bg-subtle px-8 py-5">
                          <DeliveryDetail appId={appId} endpointId={endpointId} delivery={d} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <TableFooter>{pluralize(deliveries.length, "delivery", "deliveries")}</TableFooter>
        </>
      )}
    </div>
  );
}

function DeliveryDetail({ appId, endpointId, delivery }: { appId: string; endpointId: string; delivery: WebhookDelivery }) {
  const retry = useApiMutation(() => api.webhooks.retry(appId, endpointId, delivery.id), {
    success: (d) => (d.status === "succeeded" ? "Delivered" : `Still failing${d.response_status ? ` (HTTP ${d.response_status})` : ""}`),
    invalidate: [keys.webhook(appId, endpointId), keys.webhooks(appId)],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-secondary">
        <span>
          Event <code className="text-[13px] text-fg">{delivery.event_id}</code>
        </span>
        <span>Created {formatDateTime(delivery.created_at)}</span>
        {delivery.status === "pending" && delivery.next_attempt_at ? (
          <span>Next retry {formatRelative(delivery.next_attempt_at)}</span>
        ) : null}
        {delivery.status !== "succeeded" ? (
          <Button
            size="xs"
            className="ml-auto"
            loading={retry.isPending}
            onClick={(e) => {
              e.stopPropagation();
              retry.mutate();
            }}
          >
            {retry.isPending ? null : <RefreshCw />}
            Retry now
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Request body">
          <CodeBlock lang="json" code={json(delivery.payload)} maxHeight={360} className="bg-bg" />
        </Panel>
        <Panel title="Response" aside={<HttpStatus status={delivery.response_status} />}>
          {delivery.error && delivery.response_status === null ? (
            <div className="rounded-lg border border-danger/25 bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{delivery.error}</div>
          ) : (
            <CodeBlock lang="text" wrap code={delivery.response_body || "(empty body)"} maxHeight={360} className="bg-bg" />
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Every event recorded for the app

const typeOptions = [
  { value: "all", label: "All event types" },
  ...WEBHOOK_EVENTS.map((e) => ({ value: e.type, label: e.type })),
];

export function EventLog({ appId }: { appId: string }) {
  const [type, setType] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const { data: events, isLoading, error } = useWebhookEvents(appId, type === "all" ? undefined : type);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <Select value={type} onValueChange={setType} options={typeOptions} size="sm" className="w-64" aria-label="Event type" />
        <p className="text-sm text-fg-tertiary">Every event in this app from the last 30 days, whether or not an endpoint received it.</p>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2 p-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : error ? (
        <EmptyState compact icon={<Inbox />} title="Couldn't load events" description={error.message} />
      ) : !events?.length ? (
        <EmptyState
          compact
          icon={<Inbox />}
          title="No events yet"
          description="Create an account, change a plan or edit an incentive and the event shows up here."
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 px-0" />
                  <TH icon={<Tag />} className="min-w-60">
                    Event
                  </TH>
                  <TH icon={<Hash />}>Object</TH>
                  <TH>Event ID</TH>
                  <TH icon={<Clock />}>Time</TH>
                </tr>
              </THead>
              <TBody>
                {events.map((e) => (
                  <Fragment key={e.id}>
                    <TR interactive onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                      <TD className="w-10 px-0 text-center">
                        <span className="inline-flex">
                          <Expander open={open === e.id} />
                        </span>
                      </TD>
                      <TD>
                        <code className="text-[13px] text-fg">{e.type}</code>
                      </TD>
                      <TD>{subject(e) ? <code className="text-[13px] text-fg-secondary">{subject(e)}</code> : <EmptyCell />}</TD>
                      <TD>
                        <code className="text-xs text-fg-tertiary">{e.id}</code>
                      </TD>
                      <TD>
                        <When value={e.created_at} />
                      </TD>
                    </TR>
                    {open === e.id ? (
                      <tr>
                        <td colSpan={5} className="border-b border-border bg-bg-subtle px-6 py-5">
                          <CodeBlock lang="json" code={json(e)} maxHeight={420} className="bg-bg" />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <TableFooter>
            {events.length >= 100 ? "Latest 100 events" : pluralize(events.length, "event")}
          </TableFooter>
        </>
      )}
    </div>
  );
}
