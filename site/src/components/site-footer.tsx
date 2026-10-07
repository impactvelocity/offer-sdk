import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import footerBg from "@/assets/footer-bg.webp";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_URL, DEVPOST_URL, RENDER_DEPLOY_URL } from "@/lib/env";

const creditLink = "text-inherit underline decoration-fg-muted/40 underline-offset-2 hover:text-fg";

export function SiteFooter() {
  return (
    // The closing statement and the footer row sit on the artwork; the image is bottom-anchored and its dark top is cropped.
    <footer className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        {/* Covers the whole footer so the artwork reaches behind the closing statement; narrow screens crop the sides. */}
        <Image src={footerBg} alt="" fill placeholder="blur" sizes="100vw" className="object-cover object-bottom" />
        {/* Fade the artwork up into the page, as in the hero. */}
        <div className="absolute inset-x-0 top-0 h-3/5 bg-linear-to-b from-canvas via-canvas/80 to-transparent" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="max-w-2xl font-display text-xl font-medium tracking-wider text-balance sm:text-2xl lg:text-3xl">
          <span className="text-fg">Own your access and offers.</span>{" "}
          <span className="text-fg-muted">
            Deploy the whole stack to Render in one click, or explore the demo workspace first.
          </span>
        </h2>
        <div className="flex shrink-0 flex-wrap gap-3">
          <a
            href={RENDER_DEPLOY_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            Deploy on Render
            <ArrowRight />
          </a>
          <a href={`${APP_URL}/demo-account`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Try the Demo Account
          </a>
        </div>
      </div>
      {/* Credit line, as on roundone.dev: one centered glass pill. */}
      <div className="px-4 pt-40 pb-10 sm:px-6">
        <div className="mx-auto flex max-w-fit items-center gap-3 rounded-2xl border border-border-strong/60 bg-canvas/60 px-5 py-3.5 backdrop-blur-md">
          <span aria-hidden className="flex shrink-0">
            <LogoMark className="size-5" />
          </span>
          <p className="font-mono text-[0.7rem] tracking-[0.16em] text-fg-muted">
            Offer SDK · An entry in the{" "}
            <a href={DEVPOST_URL} target="_blank" rel="noreferrer" className={creditLink}>
              PayPal AI Hackathon
            </a>{" "}
            · Created by{" "}
            <a href="https://hidylanjones.com" target="_blank" rel="noreferrer" className={creditLink}>
              Dylan Jones
            </a>{" "}
            ·{" "}
            <Link href="/how-it-works" className={creditLink}>
              How it works
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
