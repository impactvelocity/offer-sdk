"use client";

import { CalendarDays, Copy, Gift, Hash, KeyRound, Plus, Puzzle, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IncentiveDialog } from "@/components/catalog/dialogs";
import { HowItWorksButton } from "@/components/catalog/how-it-works";
import { UseSdkApiButtons } from "@/components/catalog/use-sdk-api";
import { RecordIcon } from "@/components/catalog/record";
import { RowMenu } from "@/components/catalog/row-menu";
import { OverrideBadges } from "@/components/incentives/overrides";
import { useDeleteIncentive } from "@/components/incentives/use-delete-incentive";
import { useIncentiveAccountTotals } from "@/components/incentives/use-incentive-account-totals";
import { PageBody, PageHeader, Toolbar } from "@/components/shell/page";
import { IdTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup } from "@/components/ui/input";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppId, useEntitlements, useIncentives } from "@/lib/api/hooks";
import type { Incentive } from "@/lib/api/types";
import { useNewParam } from "@/lib/use-new-param";
import { formatDate, formatNumber, pluralize } from "@/lib/utils";

export function IncentivesView() {
  const appId = useAppId();
  const router = useRouter();
  const { data: incentives, isLoading, error } = useIncentives(appId);
  const { data: entitlements = [] } = useEntitlements(appId);
  const totals = useIncentiveAccountTotals(appId, incentives?.map((i) => i.id) ?? []);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useNewParam();
  const [duplicateSource, setDuplicateSource] = useState<Incentive | null>(null);
  const onDelete = useDeleteIncentive(appId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (incentives ?? []).filter(
      (i) => !q || i.name.toLowerCase().includes(q) || i.id.includes(q) || i.description?.toLowerCase().includes(q),
    );
  }, [incentives, query]);

  const newButton = (label: string) => (
    <Button variant="primary" onClick={() => setCreateOpen(true)}>
      <Plus />
      {label}
    </Button>
  );

  return (
    <>
      <PageHeader icon={<Gift />} title="Incentives" actions={
          <>
            <UseSdkApiButtons topic="incentives" />
            <HowItWorksButton topic="incentives" />
            {newButton("New incentive")}
          </>
        } />
      <Toolbar>
        <InputGroup
          size="sm"
          leading={<Search />}
          placeholder="Search incentives"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperClassName="w-64"
        />
      </Toolbar>
      <PageBody>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={<Gift />} title="Couldn't load incentives" description={error.message} />
        ) : !incentives?.length ? (
          <EmptyState
            icon={<Gift />}
            title="No incentives yet"
            description="Incentives change what a customer gets on the fly without touching their plan: promos, partner deals, beta perks or win-back offers. Raise a limit, unlock a feature or grant an add-on, then apply it to any account."
            action={newButton("Create incentive")}
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH icon={<Gift />} className="min-w-56">
                      Incentive
                    </TH>
                    <TH icon={<Hash />}>ID</TH>
                    <TH icon={<KeyRound />} className="min-w-72">
                      Overrides
                    </TH>
                    <TH icon={<Puzzle />}>Add-ons</TH>
                    <TH icon={<Users />} align="right">
                      Accounts
                    </TH>
                    <TH icon={<CalendarDays />}>Created</TH>
                    <TH className="w-10" />
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((incentive) => (
                    <TR key={incentive.id} interactive onClick={() => router.push(`/apps/${appId}/incentives/${incentive.id}`)}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <RecordIcon size="sm" tone="orange">
                            <Gift />
                          </RecordIcon>
                          <span className="truncate font-medium">{incentive.name}</span>
                        </div>
                      </TD>
                      <TD>
                        <IdTag>{incentive.id}</IdTag>
                      </TD>
                      <TD>
                        <OverrideBadges incentive={incentive} entitlements={entitlements} />
                      </TD>
                      <TD className="tabular">{incentive.addons.length || <EmptyCell />}</TD>
                      <TD align="right">
                        {totals[incentive.id] === undefined ? <EmptyCell /> : formatNumber(totals[incentive.id])}
                      </TD>
                      <TD className="text-fg-secondary">{formatDate(incentive.created_at)}</TD>
                      <TD className="px-1">
                        <RowMenu>
                          <MenuItem onClick={() => setDuplicateSource(incentive)}>
                            <Copy />
                            Duplicate
                          </MenuItem>
                          <MenuItem onClick={() => navigator.clipboard.writeText(incentive.id)}>
                            <Hash />
                            Copy ID
                          </MenuItem>
                          <MenuItem onClick={() => router.push(`/apps/${appId}/accounts?incentive=${incentive.id}`)}>
                            <Users />
                            View accounts
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem tone="danger" onClick={() => onDelete(incentive, totals[incentive.id])}>
                            <Trash2 />
                            Delete
                          </MenuItem>
                        </RowMenu>
                      </TD>
                    </TR>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="h-24 border-b border-border text-center text-sm text-fg-tertiary">
                        No incentives match “{query.trim()}”.
                      </td>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </TableContainer>
            <TableFooter>
              {filtered.length !== incentives.length
                ? `${filtered.length} of ${pluralize(incentives.length, "incentive")}`
                : pluralize(incentives.length, "incentive")}
            </TableFooter>
          </>
        )}
      </PageBody>
      <IncentiveDialog appId={appId} open={createOpen} onOpenChange={setCreateOpen} />
      <IncentiveDialog
        appId={appId}
        open={Boolean(duplicateSource)}
        onOpenChange={(o) => !o && setDuplicateSource(null)}
        source={duplicateSource}
      />
    </>
  );
}
