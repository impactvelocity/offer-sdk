"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import poster from "@/assets/walkthrough-poster.jpg";
import { WALKTHROUGH_VIDEO_ID } from "@/lib/env";
import { cn } from "@/lib/utils";

const DURATION = "02:20";

// Viewfinder marks in each corner of the still; they close in on hover.
const corners = [
  "top-2.5 left-2.5 sm:top-4 sm:left-4 border-t-2 border-l-2 rounded-tl-md group-hover:translate-x-1.5 group-hover:translate-y-1.5",
  "top-2.5 right-2.5 sm:top-4 sm:right-4 border-t-2 border-r-2 rounded-tr-md group-hover:-translate-x-1.5 group-hover:translate-y-1.5",
  "bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 border-b-2 border-l-2 rounded-bl-md group-hover:translate-x-1.5 group-hover:-translate-y-1.5",
  "bottom-2.5 right-2.5 sm:bottom-4 sm:right-4 border-r-2 border-b-2 rounded-br-md group-hover:-translate-x-1.5 group-hover:-translate-y-1.5",
];

/**
 * The walkthrough video under the hero. Shows a still until it's clicked, then swaps in the
 * YouTube player, so the page doesn't load YouTube up front.
 */
export function WalkthroughVideo({ className }: { className?: string }) {
  const [playing, setPlaying] = useState(false);
  const ready = WALKTHROUGH_VIDEO_ID !== "";

  return (
    <div className={cn("relative", className)}>
      <div className="absolute -inset-x-10 -top-16 -bottom-10 -z-10 bg-brand-glow blur-2xl" aria-hidden />
      <div className="video-frame rounded-2xl p-px shadow-2xl shadow-black/50">
        <div className="overflow-hidden rounded-[15px] bg-panel">
          <div className="flex h-10 items-center justify-between border-b border-border px-4 font-mono text-xs text-fg-muted">
            <span className="inline-flex items-center gap-2">
              <span className="video-rec size-2 rounded-full bg-accent" aria-hidden />
              offer-sdk-walkthrough.mp4
            </span>
            <span className="tabular">{DURATION}</span>
          </div>
          <div className="relative aspect-video bg-canvas">
            {playing ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${WALKTHROUGH_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                title="Offer SDK walkthrough"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                disabled={!ready}
                className="group focus-ring absolute inset-0 flex items-center justify-center overflow-hidden disabled:cursor-default"
              >
                <Image
                  src={poster}
                  alt=""
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1152px) 1104px, 100vw"
                  className="object-cover brightness-75 grayscale transition duration-500 group-enabled:group-hover:scale-[1.02] group-enabled:group-hover:brightness-90"
                />
                {/* Tint the still green so it matches the page until it plays. */}
                <div className="absolute inset-0 bg-accent opacity-35 mix-blend-color" aria-hidden />
                <div className="absolute inset-0 bg-linear-to-t from-canvas/80 via-canvas/10 to-canvas/30" aria-hidden />
                {corners.map((position) => (
                  <span
                    key={position}
                    className={cn("absolute size-4 border-accent/80 sm:size-6 transition-transform duration-300", position)}
                    aria-hidden
                  />
                ))}
                <span className="btn-neon relative inline-flex h-11 items-center gap-2 rounded-full bg-canvas/70 pr-4 pl-2 text-sm font-medium sm:h-14 sm:gap-3 sm:pr-6 sm:pl-3 sm:text-base tracking-wide backdrop-blur-md transition group-enabled:group-hover:bg-canvas/80">
                  <span className="relative flex size-7 items-center justify-center sm:size-9 rounded-full bg-accent text-accent-contrast">
                    {ready && <span className="video-ping absolute inset-0 rounded-full bg-accent" aria-hidden />}
                    <Play className="relative size-3.5 translate-x-px sm:size-4 fill-current" aria-hidden />
                  </span>
                  {ready ? "Watch the walkthrough" : "Walkthrough coming soon"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
