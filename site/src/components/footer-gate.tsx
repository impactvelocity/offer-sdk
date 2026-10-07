"use client";

import { usePathname } from "next/navigation";

/** Leaves the footer off the docs, so the article scrolls to its end without the closing artwork. */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return null;
  return children;
}
