import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { FooterGate } from "@/components/footer-gate";
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

// Site-wide defaults. Marketing pages set their own title and share card with pageMetadata();
// docs pages keep this openGraph (and its image), and share cards fall back to their <title>.
export const metadata: Metadata = {
  metadataBase: new URL("https://offersdk.com"),
  title: { default: "Offer SDK", template: "%s · Offer SDK" },
  openGraph: { type: "website", siteName: "Offer SDK" },
  twitter: { card: "summary_large_image" },
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
        <FooterGate>
          <SiteFooter />
        </FooterGate>
      </body>
    </html>
  );
}
