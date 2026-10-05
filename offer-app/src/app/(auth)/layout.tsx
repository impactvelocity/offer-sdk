import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col bg-bg-subtle bg-brand-glow">
      <header className="flex h-16 items-center justify-center">
        <Link href="/" aria-label="Offer SDK">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[8vh]">{children}</main>
      <footer className="flex h-12 items-center justify-center gap-4 text-xs text-fg-tertiary">
        <span>© {new Date().getFullYear()} Offer SDK</span>
      </footer>
    </div>
  );
}
