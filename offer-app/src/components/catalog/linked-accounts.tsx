"use client";

import { Hash, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "./pagination";

/** Paginated list of accounts attached to a plan or incentive. */
export function LinkedAccounts({
  appId,
  rows,
  total,
  page,
  perPage,
  onPageChange,
  loading,
  emptyTitle,
  emptyDescription,
  extraColumn,
}: {
  appId: string;
  rows: { id: string; name: string }[] | undefined;
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  emptyTitle: string;
  emptyDescription?: ReactNode;
  extraColumn?: { header: ReactNode; cell: (row: { id: string; name: string }) => ReactNode };
}) {
  const router = useRouter();
  if (loading && !rows) {
    return (
      <div className="flex flex-col gap-2 p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }
  if (!rows?.length) {
    return <EmptyState compact icon={<Users />} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <>
      <TableContainer>
        <Table>
          <THead>
            <tr>
              <TH icon={<Users />}>Account</TH>
              <TH icon={<Hash />}>ID</TH>
              {extraColumn ? <TH>{extraColumn.header}</TH> : null}
            </tr>
          </THead>
          <TBody>
            {rows.map((a) => (
              <TR key={a.id} interactive onClick={() => router.push(`/apps/${appId}/accounts/${encodeURIComponent(a.id)}`)}>
                <TD>
                  <div className="flex items-center gap-2">
                    <Avatar name={a.name || a.id} seed={a.id} />
                    <span className="truncate font-medium">{a.name || a.id}</span>
                  </div>
                </TD>
                <TD>
                  <code className="text-xs text-fg-secondary">{a.id}</code>
                </TD>
                {extraColumn ? <TD>{extraColumn.cell(a)}</TD> : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      <Pagination page={page} perPage={perPage} total={total} onPageChange={onPageChange} />
    </>
  );
}
