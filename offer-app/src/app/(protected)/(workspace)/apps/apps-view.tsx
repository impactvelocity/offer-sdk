"use client";

import { ArrowUpRight, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { CreateAppDialog } from "@/components/apps/create-app-dialog";
import { PageBody, PageHeader } from "@/components/shell/page";
import { useWorkspaceContext } from "@/components/shell/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { IdTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useApps } from "@/lib/api/hooks";
import { useNewParam } from "@/lib/use-new-param";
import { formatDate } from "@/lib/utils";

export function AppsView() {
  const { workspace } = useWorkspaceContext();
  const { data: apps, isLoading } = useApps();
  const [open, setOpen] = useNewParam();

  return (
    <>
      <PageHeader
        icon={<LayoutGrid />}
        title="Apps"
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus />
            New App
          </Button>
        }
      />
      <PageBody width="wide">
        <div className="mb-5">
          <h2 className="font-display text-xl font-semibold">{workspace.name}</h2>
          <p className="mt-0.5 text-sm text-fg-tertiary">
            Each app is a product whose access, limits and offers you control from here.
          </p>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-lg" />
            ))}
          </div>
        ) : !apps?.length ? (
          <div className="rounded-lg border border-dashed border-border-strong">
            <EmptyState
              icon={<LayoutGrid />}
              title="Create your first app"
              description="Apps hold your plans, entitlements and customer accounts, plus the API keys your product uses."
              action={
                <Button variant="primary" onClick={() => setOpen(true)}>
                  <Plus />
                  New App
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                className="group flex flex-col rounded-xl border border-border bg-bg p-5 shadow-sm outline-none transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-soft focus-visible:shadow-[0_0_0_3px_var(--ring)]"
              >
                <div className="flex items-start justify-between">
                  <Avatar name={app.name} seed={app.id} size="xl" variant="solid" />
                  <ArrowUpRight className="size-4 text-fg-placeholder transition-colors group-hover:text-fg-secondary" />
                </div>
                <div className="mt-3 truncate text-base font-semibold text-fg">{app.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-fg-tertiary">
                  <IdTag>{app.id}</IdTag>
                  <span>Created {formatDate(app.created_at)}</span>
                </div>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-h-[118px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-sm text-fg-tertiary outline-none transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:shadow-[0_0_0_3px_var(--ring)]"
            >
              <Plus className="size-4" />
              New app
            </button>
          </div>
        )}
      </PageBody>
      <CreateAppDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
