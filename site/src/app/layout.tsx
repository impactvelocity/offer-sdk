import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Cal Sans v2 (variable: weight + optical size + GEOM), from the `cal-sans` package, as in offer-app.
const calSans = localFont({
  src: "../../node_modules/cal-sans/fonts/calsans-var-full/CalSansVF.woff2",
  variable: "--font-cal-sans",
  weight: "400 700",
  display: "swap",
});

// Mono for code and section numbers.
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Offer SDK: plans, entitlements and offers for your app", template: "%s · Offer SDK" },
  description:
    "Manage plans, entitlements, incentives and offers from one dashboard, and sell them with PayPal checkout from a React SDK.",
};

export const viewport: Viewport = {
  themeColor: "#0f0f11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${calSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
