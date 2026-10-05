"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  noun = "accounts",
}: {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  noun?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="flex h-12 items-center gap-2 border-b border-border px-4 text-sm text-fg-tertiary">
      <span className="tabular">
        {total === 0 ? `0 ${noun}` : `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)} ${noun}`}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button icon size="xs" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <span className="tabular text-xs">
          {page} / {pages}
        </span>
        <Button icon size="xs" variant="ghost" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
