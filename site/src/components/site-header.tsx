import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_URL } from "@/lib/env";

const nav = [
  { href: "/why", label: "Why Offer SDK" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/what-you-get", label: "What you get" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-canvas/75 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="focus-ring shrink-0 rounded-md" aria-label="Offer SDK home">
          <Logo />
        </Link>
        <div className="hidden items-center lg:flex xl:gap-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {item.label}
            </Link>
          ))}
        </div>
        <a href={`${APP_URL}/demo-account`} className={buttonVariants({ variant: "primary", size: "sm", className: "ml-auto" })}>
          Try demo account
        </a>
      </nav>
    </header>
  );
}
