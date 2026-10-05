import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_URL } from "@/lib/env";

const nav = [
  { href: "#platform", label: "Platform" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#developers", label: "Developers" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-canvas/75 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="focus-ring rounded-md" aria-label="Offer SDK home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {item.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href={`${APP_URL}/sign-in`} className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
            Sign in
          </a>
          <a href={`${APP_URL}/sign-up`} className={buttonVariants({ variant: "primary", size: "sm" })}>
            Get started
          </a>
        </div>
      </nav>
    </header>
  );
}
