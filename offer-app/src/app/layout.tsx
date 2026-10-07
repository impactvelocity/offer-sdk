import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { themeScript } from "@/lib/theme-script";
import { Providers } from "./providers";
import "./globals.css";

// Cal Sans v2 (variable: weight + optical size + GEOM), from the `cal-sans` package.
const calSans = localFont({
  src: "../../node_modules/cal-sans/fonts/calsans-var-full/CalSansVF.woff2",
  variable: "--font-cal-sans",
  weight: "400 700",
  display: "swap",
});

// Mono for code, IDs and the Neon-style eyebrow labels.
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Offer SDK", template: "%s · Offer SDK" },
  description: "Manage entitlements, plans, incentives and offers for your product.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the inline script before hydration, hence suppressHydrationWarning.
    <html lang="en" className={`${calSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
