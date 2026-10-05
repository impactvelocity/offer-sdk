"use client";

import { BadgePercent, CalendarClock, CalendarDays, Copy, Hash, Layers, Link2, Plus, Search, ShoppingBag, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RecordIcon } from "@/components/catalog/record";
import { RowMenu } from "@/components/catalog/row-menu";
import { discountSummary, offerLink, offerState } from "@/components/offers/format";
import { PaypalCallout } from "@/components/offers/paypal-callout";
import { useOfferActions } from "@/components/offers/use-offer-actions";
import { PageBody, PageHeader, Toolbar } from "@/components/shell/page";
import { Badge, Chip, IdTag } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup } from "@/components/ui/input";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { EmptyCell, Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useApp, useAppId, useOffers, usePlans } from "@/lib/api/hooks";
import { formatDate, formatNumber, pluralize } from "@/lib/utils";

export function OffersView() {
  const appId = useAppId();
  const router = useRouter();
  const { data: offers, isLoading, error } = useOffers(appId);
  const { data: plans = [] } = usePlans(appId);
  const { data: app } = useApp(appId);
  const actions = useOfferActions(appId);
  const [query, setQuery] = useState("");
  const planName = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (offers ?? []).filter((o) => !q || o.name.toLowerCase().includes(q) || o.id.includes(q));
  }, [offers, query]);

  const newButton = (label: string) => (
    <Link href={`/apps/${appId}/offers/new`} className={buttonVariants({ variant: "primary" })}>
      <Plus />
      {label}
    </Link>
  );

  const copyLink = (offerId: string) => {
    if (!app) return;
    void navigator.clipboard.writeText(offerLink(app, offerId, undefined, window.location.origin));
    toast.success("Checkout link copied");
  };

  return (
    <>
      <PageHeader icon={<BadgePercent />} title="Offers" actions={offers !== null ? newButton("New offer") : null} />
      <Toolbar>
        <InputGroup
          size="sm"
          leading={<Search />}
          placeholder="Search offers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperClassName="w-64"
        />
      </Toolbar>
      <PageBody>
        <PaypalCallout appId={appId} className="mx-6 mt-4" />
        {isLoading ? (
          <div className="flex flex-col gap-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={<BadgePercent />} title="Couldn't load offers" description={error.message} />
        ) : offers === null ? (
          <EmptyState
            icon={<BadgePercent />}
            title="Offers need the Offer API"
            description="The in-memory mock doesn't sell anything. Point OFFER_API_URL at the Offer API to create offers and take payments with PayPal."
          />
        ) : !offers?.length ? (
          <EmptyState
            icon={<BadgePercent />}
            title="No offers yet"
            description="An offer is a deal on your plans: a lower price for a while, extra limits, and add-ons sold at checkout. Share its link in ads, with affiliates or from support, and buyers pay with PayPal."
            action={newButton("Create offer")}
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH icon={<BadgePercent />} className="min-w-56">
                      Offer
                    </TH>
                    <TH icon={<Hash />}>ID</TH>
                    <TH icon={<Tag />}>Status</TH>
                    <TH icon={<Layers />} className="min-w-56">
                      Plans
                    </TH>
                    <TH icon={<BadgePercent />}>Deal</TH>
                    <TH icon={<ShoppingBag />} align="right">
                      Sales
                    </TH>
                    <TH icon={<CalendarClock />}>Ends</TH>
                    <TH icon={<CalendarDays />}>Created</TH>
                    <TH className="w-10" />
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((offer) => {
                    const state = offerState(offer);
                    return (
                      <TR key={offer.id} interactive onClick={() => router.push(`/apps/${appId}/offers/${encodeURIComponent(offer.id)}`)}>
                        <TD>
                          <div className="flex items-center gap-2">
                            <RecordIcon size="sm" tone="pink">
                              <BadgePercent />
                            </RecordIcon>
                            <span className="truncate font-medium">{offer.name}</span>
                          </div>
                        </TD>
                        <TD>
                          <IdTag>{offer.id}</IdTag>
                        </TD>
                        <TD>
                          <Badge color={state.color} dot>
                            {state.label}
                          </Badge>
                        </TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {offer.plans.map((p) => (
                              <Chip key={p.plan_id} icon={<Layers />}>
                                {planName.get(p.plan_id) ?? p.plan_id}
                              </Chip>
                            ))}
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap text-fg-secondary">{discountSummary(offer)}</TD>
                        <TD align="right" className="tabular">
                          {formatNumber(offer.redemptions ?? 0)}
                          {offer.max_redemptions ? <span className="text-fg-tertiary"> / {formatNumber(offer.max_redemptions)}</span> : null}
                        </TD>
                        <TD className="text-fg-secondary">{offer.expires_at ? formatDate(offer.expires_at) : <EmptyCell />}</TD>
                        <TD className="text-fg-secondary">{formatDate(offer.created_at)}</TD>
                        <TD className="px-1">
                          <RowMenu>
                            <MenuItem onClick={() => copyLink(offer.id)}>
                              <Link2 />
                              Copy checkout link
                            </MenuItem>
                            <MenuItem onClick={() => router.push(`/apps/${appId}/offers/new?from=${encodeURIComponent(offer.id)}`)}>
                              <Copy />
                              Duplicate
                            </MenuItem>
                            <MenuItem onClick={() => navigator.clipboard.writeText(offer.id)}>
                              <Hash />
                              Copy ID
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem tone="danger" onClick={() => actions.remove(offer)}>
                              <Trash2 />
                              Delete
                            </MenuItem>
                          </RowMenu>
                        </TD>
                      </TR>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="h-24 border-b border-border text-center text-sm text-fg-tertiary">
                        No offers match “{query.trim()}”.
                      </td>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </TableContainer>
            <TableFooter>
              {filtered.length !== offers.length
                ? `${filtered.length} of ${pluralize(offers.length, "offer")}`
                : pluralize(offers.length, "offer")}
            </TableFooter>
          </>
        )}
      </PageBody>
    </>
  );
}
