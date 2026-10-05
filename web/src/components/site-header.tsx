import Link from "next/link";
import { APP_URL } from "@/lib/env";

export function SiteHeader() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Offer
        </Link>
        <a
          href={APP_URL}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Open app
        </a>
      </nav>
    </header>
  );
}
