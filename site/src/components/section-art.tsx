import Image from "next/image";
import type { ReactNode } from "react";
import sectionBg from "@/assets/section-bg.webp";
import { cn } from "@/lib/utils";

/**
 * A full-width section on the dimmed line artwork, faded into the page at the top and bottom so
 * it reads as a band. Content goes on opaque cards so it stays readable over the art.
 */
export function SectionArt({
  id,
  className,
  artClassName = "opacity-25",
  children,
}: {
  id?: string;
  className?: string;
  /** Classes for the artwork image, mainly its opacity. */
  artClassName?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("relative isolate scroll-mt-20 overflow-hidden", className)}>
      <div className="absolute inset-0 -z-10" aria-hidden>
        <Image src={sectionBg} alt="" fill placeholder="blur" sizes="100vw" className={cn("object-cover", artClassName)} />
        <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-canvas to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-canvas to-transparent" />
      </div>
      {children}
    </section>
  );
}
