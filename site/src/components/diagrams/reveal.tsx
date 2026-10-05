"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Plays the diagram load-in (see `[data-reveal]` in globals.css) once it scrolls into view. */
export function DiagramReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={shown ? "in" : "out"} className={className}>
      {children}
    </div>
  );
}
