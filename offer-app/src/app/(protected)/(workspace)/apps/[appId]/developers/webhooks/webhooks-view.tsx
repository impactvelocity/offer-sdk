"use client";

import { Activity, BookOpen, Clock, Copy, Pause, Play, Plus, Send, Tag, Trash2, Webhook, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RowMenu } from "@/components/catalog/row-menu";
import { PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { useAppId, useWebhooks } from "@/lib/api/hooks";
import { useNewParam } from "@/lib/use-new-param";
import { formatRelative, pluralize } from "@/lib/utils";
import type { WebhookEventType } from "@/lib/webhooks/catalog";
import { useDeleteEndpoint, useSendTest, useToggleEndpoint } from "@/components/webhooks/actions";
import { EndpointIcon, EndpointStatus, EventsSummary, endpointName, shortUrl, successRate, ZapierMark } from "@/components/webhooks/bits";
import { EndpointDialog } from "@/components/webhooks/endpoint-dialog";
import { EventLog } from "@/components/webhooks/logs";
import { DeliveryRules, EventReference, VerifySignatures } from "@/components/webhooks/reference";
import { ZapierCard, ZapierConnectDialog } from "@/components/webhooks/zapier";

export function WebhooksView() {
  const appId = useAppId();
  const router = useRouter();
  const { data: endpoints, isLoading, error } = useWebhooks(appId);
  const [createOpen, setCreateOpen] = useNewParam();
  const [zapier, setZapier] = useState<{ open: boolean; event?: WebhookEventType }>({ open: false });
  const sendTest = useSendTest(appId);
  const toggle = useToggleEndpoint(appId);
  const onDelete = useDeleteEndpoint(appId);

  const connectZapier = (event?: WebhookEventType) => setZapier({ open: true, event });
  const hasZapier = endpoints?.some((e) => e.source === "zapier");

  return (
    <>
      <PageHeader
        icon={<Webhook />}
        title="Webhooks"
        actions={
          <>
            <Button onClick={() => connectZapier()}>
              <ZapierMark />
              Connect Zapier
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus />
              Add endpoint
            </Button>
          </>
        }
      />
      <Tabs defaultValue="endpoints" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <Tab value="endpoints" icon={<Webhook />} count={endpoints?.length ?? null}>
            Endpoints
          </Tab>
          <Tab value="events" icon={<Activity />}>
            Event log
          </Tab>
          <Tab value="docs" icon={<BookOpen />}>
            Events &amp; signing
          </Tab>
        </TabsList>

        <TabsPanel value="endpoints" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : error ? (
            <EmptyState icon={<Webhook />} title="Couldn't load webhooks" description={error.message} />
          ) : !endpoints?.length ? (
            <div className="pb-10">
              <EmptyState
                icon={<Webhook />}
                title="Send events to the rest of your stack"
                description="Get a signed HTTP request the moment an account upgrades, hits a usage limit or picks up an incentive. Point it at your own server, or connect Zapier and skip the code."
                action={
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus />
                    Add endpoint
                  </Button>
                }
              />
              <ZapierCard onConnect={connectZapier} className="mx-auto max-w-[760px]" />
            </div>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <THead>
                    <tr>
                      <TH icon={<Webhook />} className="min-w-72">
                        Endpoint
                      </TH>
                      <TH icon={<Tag />}>Events</TH>
                      <TH icon={<Zap />}>Status</TH>
                      <TH align="right">Success (7d)</TH>
                      <TH icon={<Clock />}>Last delivery</TH>
                      <TH className="w-10" />
                    </tr>
                  </THead>
                  <TBody>
                    {endpoints.map((endpoint) => {
                      const rate = successRate(endpoint.stats);
                      return (
                        <TR
                          key={endpoint.id}
                          interactive
                          onClick={() => router.push(`/apps/${appId}/developers/webhooks/${endpoint.id}`)}
                        >
                          <TD className="h-14">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <EndpointIcon source={endpoint.source} />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{endpointName(endpoint)}</div>
                                <code className="block max-w-[420px] truncate text-xs text-fg-tertiary">{shortUrl(endpoint.url)}</code>
                              </div>
                            </div>
                          </TD>
                          <TD>
                            <EventsSummary events={endpoint.events} />
                          </TD>
                          <TD>
                            <EndpointStatus endpoint={endpoint} />
                          </TD>
                          <TD align="right">
                            {rate === null ? (
                              <EmptyCell />
                            ) : (
                              <span className={rate < 90 ? "text-danger-fg" : undefined}>
                                {rate}%
                                <span className="ml-1.5 text-fg-tertiary">of {endpoint.stats.succeeded + endpoint.stats.failed}</span>
                              </span>
                            )}
                          </TD>
                          <TD className="text-fg-secondary">
                            {endpoint.stats.last_delivery_at ? formatRelative(endpoint.stats.last_delivery_at) : <EmptyCell />}
                          </TD>
                          <TD className="px-1">
                            <RowMenu>
                              <MenuItem onClick={() => sendTest.mutate({ endpoint })}>
                                <Send />
                                Send test event
                              </MenuItem>
                              <MenuItem onClick={() => toggle.mutate(endpoint)}>
                                {endpoint.enabled ? <Pause /> : <Play />}
                                {endpoint.enabled ? "Pause" : "Resume"}
                              </MenuItem>
                              <MenuItem onClick={() => navigator.clipboard.writeText(endpoint.url)}>
                                <Copy />
                                Copy URL
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem tone="danger" onClick={() => onDelete(endpoint)}>
                                <Trash2 />
                                Delete
                              </MenuItem>
                            </RowMenu>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableContainer>
              <TableFooter>{pluralize(endpoints.length, "endpoint")}</TableFooter>
              {!hasZapier ? (
                <div className="p-6">
                  <ZapierCard onConnect={connectZapier} className="max-w-[760px]" />
                </div>
              ) : null}
            </>
          )}
        </TabsPanel>

        <TabsPanel value="events" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <EventLog appId={appId} />
        </TabsPanel>

        <TabsPanel value="docs" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[820px] px-8 py-10">
            <EventReference appId={appId} />
            <DeliveryRules />
            <VerifySignatures />
          </div>
        </TabsPanel>
      </Tabs>

      <EndpointDialog appId={appId} open={createOpen} onOpenChange={setCreateOpen} />
      <ZapierConnectDialog
        key={zapier.event ?? "any"}
        appId={appId}
        open={zapier.open}
        initialEvent={zapier.event}
        onOpenChange={(open) => setZapier((z) => ({ ...z, open }))}
      />
    </>
  );
}
