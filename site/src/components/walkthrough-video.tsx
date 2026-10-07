import { WALKTHROUGH_VIDEO_ID } from "@/lib/env";
import { cn } from "@/lib/utils";

/** The walkthrough video under the hero: the YouTube player itself, in the brand-gradient frame. */
export function WalkthroughVideo({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute -inset-x-10 -top-16 -bottom-10 -z-10 bg-brand-glow blur-2xl" aria-hidden />
      <div className="video-frame rounded-[25px] p-px sm:rounded-[33px] shadow-2xl shadow-black/50">
        {/* Inner radius = frame radius minus padding, so the corners stay concentric. */}
        <div className="rounded-3xl bg-panel p-2 sm:rounded-[32px] sm:p-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-canvas sm:rounded-[20px]">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${WALKTHROUGH_VIDEO_ID}?rel=0&modestbranding=1`}
              title="Offer SDK walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
