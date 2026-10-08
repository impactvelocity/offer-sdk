"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Diagrams that scroll in together (a row of cards) queue up and start this far apart, in page order.
const STAGGER = 0.15;
let queueEnd = 0;

function nextDelay() {
  const now = performance.now() / 1000;
  const start = Math.max(now, queueEnd);
  queueEnd = start + STAGGER;
  return start - now;
}

/** Plays the diagram load-in (see `[data-reveal]` in globals.css) once it scrolls into view. */
export function DiagramReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [delay, setDelay] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setDelay(nextDelay());
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={delay === null ? "out" : "in"}
      style={delay === null ? undefined : ({ "--reveal-delay": `${delay.toFixed(2)}s` } as CSSProperties)}
      className={className}
    >
      {children}
    </div>
  );
}
