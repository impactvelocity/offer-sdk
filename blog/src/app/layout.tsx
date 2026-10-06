import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { SignOutLink } from "@/components/sign-out";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog",
  description: "A Rails-style blog that exercises the Offer API and SDK.",
};

const Sep = () => <span className="sep">|</span>;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <div id="nav">
          <Link href="/">Posts</Link>
          <Sep />
          <Link href="/pricing">Pricing</Link>
          <Sep />
          <Link href="/account">My account</Link>
          <span className="sep">||</span>
          <span className="muted">admin:</span> <Link href="/offers">Offers</Link>
          <Sep />
          <Link href="/webhooks">Webhooks</Link>
          <Sep />
          <Link href="/stats">Stats</Link>
          <Sep />
          <Link href="/console">rake test</Link>
          <Sep />
          <Link href="/setup">Setup</Link>
          <span className="who">
            {user ? (
              <>
                Signed in as <b>{user.email}</b>. <SignOutLink />
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link> or <Link href="/signup">Sign up</Link>
              </>
            )}
          </span>
        </div>
        {children}
      </body>
    </html>
  );
}
