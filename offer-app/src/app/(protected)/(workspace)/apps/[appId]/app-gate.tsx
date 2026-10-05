"use client";

import { LayoutGrid, SearchX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useApp } from "@/lib/api/hooks";

/** Renders the page once the app is known to exist in this workspace. */
export function AppGate({ appId, children }: { appId: string; children: ReactNode }) {
  const { error } = useApp(appId);
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<SearchX />}
          title="App not found"
          description="It may have been deleted, or it belongs to another workspace."
          action={
            <Link href="/apps" className={buttonVariants({ variant: "primary" })}>
              <LayoutGrid />
              All apps
            </Link>
          }
        />
      </div>
    );
  }
  return children;
}
