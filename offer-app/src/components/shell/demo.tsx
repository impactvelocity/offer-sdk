"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { useIsDemo } from "./workspace-context";

/** Top of every page on the shared demo login: it's read-only, and the way back to sign-in. */
export function DemoBanner() {
  const router = useRouter();
  if (!useIsDemo()) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-accent/25 bg-accent-subtle px-4 py-2 text-sm text-fg-secondary">
      <Eye className="size-4 shrink-0 text-accent-fg" />
      <p className="min-w-0 flex-1">
        <span className="font-medium text-fg">Read-only demo.</span> Explore the sample apps and data. Changes are
        turned off.
      </p>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.push("/sign-in");
          router.refresh();
        }}
        className="shrink-0 font-medium text-accent-fg hover:underline underline-offset-2"
      >
        Sign out
      </button>
    </div>
  );
}

/** Disables every control inside on the demo login (a disabled fieldset), leaving them visible. */
export function DemoLock({ children }: { children: ReactNode }) {
  const demo = useIsDemo();
  return (
    <fieldset disabled={demo} className="contents">
      {children}
    </fieldset>
  );
}
