import Link from "next/link";
import { GithubMark } from "@/components/brand/github-mark";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_URL, GITHUB_URL } from "@/lib/env";

const nav = [
  { href: "/why", label: "Pricing Spaghetti" },
  { href: "/how-it-works", label: "React SDK" },
  { href: "/what-you-get", label: "What You Get" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-canvas/75 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="focus-ring flex shrink-0 items-center rounded-md" aria-label="Offer SDK home">
          <Logo />
        </Link>
        <div className="hidden items-center lg:flex xl:gap-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {item.label}
            </Link>
          ))}
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Offer SDK on GitHub"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "ml-auto -mr-3 w-8 px-0 [&_svg]:size-5" })}
        >
          <GithubMark />
        </a>
        <a href={`${APP_URL}/demo-account`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "primary", size: "sm" })}>
          Try Demo Account
        </a>
      </nav>
    </header>
  );
}
