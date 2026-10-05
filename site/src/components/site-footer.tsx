import { ArrowRight } from "lucide-react";
import Image from "next/image";
import footerBg from "@/assets/footer-bg.webp";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_URL } from "@/lib/env";

export function SiteFooter() {
  return (
    // The closing CTA and the footer row sit on the artwork; the image is bottom-anchored and its dark top is cropped.
    <footer className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        {/* Covers the whole footer so the artwork reaches behind the CTA card; narrow screens crop the sides. */}
        <Image src={footerBg} alt="" fill placeholder="blur" sizes="100vw" className="object-cover object-bottom" />
        {/* Fade the artwork up into the page, as in the hero. */}
        <div className="absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-canvas to-transparent" />
      </div>
      <div className="px-4 pt-8 sm:px-6">
        {/* Translucent so the artwork shows through the card. */}
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border bg-panel/60 px-6 py-16 text-center backdrop-blur-sm">
          <div className="absolute inset-0 -z-10 bg-brand-glow" aria-hidden />
          <h2 className="font-display text-3xl font-semibold text-balance sm:text-4xl">Ship your next offer today</h2>
          <p className="mx-auto mt-4 max-w-xl text-fg-muted">
            Create a workspace, connect PayPal and send your first offer link.
          </p>
          <a href={`${APP_URL}/sign-up`} className={buttonVariants({ variant: "primary", size: "xl", className: "mt-8" })}>
            Get started free
            <ArrowRight />
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-24 pb-10 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="inline-flex items-center gap-2">
          <LogoMark className="size-5" />© {new Date().getFullYear()} Offer SDK
        </span>
        <div className="flex gap-5">
          <a href="#features" className="hover:text-fg">
            Features
          </a>
          <a href="#developers" className="hover:text-fg">
            Developers
          </a>
        </div>
      </div>
    </footer>
  );
}
