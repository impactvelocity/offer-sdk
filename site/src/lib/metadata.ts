import type { Metadata } from "next";

/**
 * Title, description and share card for a marketing page. A page's `openGraph` replaces the
 * layout's rather than merging with it, so this repeats the site name and the share image
 * (src/app/opengraph-image.tsx) that the page would otherwise lose.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** Skip the "· Offer SDK" suffix (the home page, whose headline already names it). */
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    openGraph: { type: "website", siteName: "Offer SDK", title, description, url: path, images: "/opengraph-image" },
  };
}
