/**
 * SVG defs for the brand gradient: a green→cyan stroke, and a matching wash that fades out
 * towards the baseline (horizontal color, vertical fade via a mask).
 */
export function BrandGradientDefs({ id, fillOpacity = 0.28 }: { id: string; fillOpacity?: number }) {
  return (
    <defs>
      <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--brand-from)" />
        <stop offset="1" stopColor="var(--brand-to)" />
      </linearGradient>
      <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--brand-from)" stopOpacity={fillOpacity} />
        <stop offset="1" stopColor="var(--brand-to)" stopOpacity={fillOpacity} />
      </linearGradient>
      <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="1" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id={`${id}-mask`} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
        <rect width="1" height="1" fill={`url(#${id}-fade)`} />
      </mask>
    </defs>
  );
}

/** Ids are used in url(#…) references, so strip the colons React's useId produces. */
export const svgId = (reactId: string) => `g${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
