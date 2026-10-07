import { cn, initials } from "@/lib/utils";

const palette = [
  "bg-tag-blue-bg text-tag-blue-fg",
  "bg-tag-green-bg text-tag-green-fg",
  "bg-tag-orange-bg text-tag-orange-fg",
  "bg-tag-purple-bg text-tag-purple-fg",
  "bg-tag-pink-bg text-tag-pink-fg",
  "bg-tag-teal-bg text-tag-teal-fg",
  "bg-tag-yellow-bg text-tag-yellow-fg",
];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  seed,
  size = "sm",
  shape = "rounded",
  variant = "soft",
  className,
}: {
  name: string | null | undefined;
  seed?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "rounded" | "circle";
  /** `solid`: bold accent-green tile with dark initials (app icons). */
  variant?: "soft" | "solid";
  className?: string;
}) {
  const dims = {
    xs: "size-4 text-[9px]",
    sm: "size-5 text-[10px]",
    md: "size-6 text-[11px]",
    lg: "size-8 text-xs",
    xl: "size-10 text-sm",
  }[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center uppercase leading-none",
        shape === "circle" ? "rounded-full" : size === "xl" || size === "lg" ? "rounded-lg" : "rounded-[5px]",
        variant === "solid"
          ? cn(
              // App icons all share the main accent green; the initials tell them apart.
              "bg-accent font-bold tracking-wide text-accent-contrast shadow-[inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-1px_0_rgb(0_0_0/0.12),0_1px_2px_rgb(16_17_19/0.18)]",
            )
          : cn("font-semibold", palette[hash(seed ?? name ?? "") % palette.length]),
        dims,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
