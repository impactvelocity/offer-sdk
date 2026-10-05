"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Open state for a "create" dialog that can also be opened with `?new=1`
 * (used by the quick-actions menu). Clears the param once consumed.
 */
export function useNewParam(): [boolean, (open: boolean) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const requested = params.get("new") === "1";

  // Open when the param appears (state adjusted during render, not in an effect).
  const [seen, setSeen] = useState(false);
  if (requested !== seen) {
    setSeen(requested);
    if (requested) setOpen(true);
  }

  useEffect(() => {
    if (!requested) return;
    const next = new URLSearchParams(params);
    next.delete("new");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [requested, params, pathname, router]);

  return [open, useCallback((value: boolean) => setOpen(value), [])];
}
