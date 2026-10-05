import { cn } from "@/lib/utils";

// Variants match offer-app/src/components/ui/button.tsx, plus an `xl` size for hero CTAs.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium tracking-wide select-none transition-[background-color,border-color,box-shadow,color] duration-100 focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    // Dark outer edge, a 1px light inner border just inside it, then a soft drop shadow.
    "bg-brand-vertical text-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.22),inset_0_0_0_2px_rgb(255_255_255/0.18),var(--shadow-sm)] transition-[filter,box-shadow] hover:brightness-110 active:brightness-95",
  secondary: "bg-bg text-fg ring-1 ring-inset ring-border-strong shadow-xs hover:bg-bg-hover",
  ghost: "text-fg-secondary hover:bg-bg-hover hover:text-fg",
  link: "h-auto px-0 text-accent-fg hover:underline underline-offset-2",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-sm [&_svg]:size-4",
  md: "h-9 px-3 text-sm [&_svg]:size-4",
  lg: "h-10 px-4 text-base [&_svg]:size-[18px]",
  xl: "h-12 rounded-lg px-5 text-base [&_svg]:size-[18px]",
};

/**
 * Class names for a button; use on `<a>` / `<Link>` for navigation CTAs. Kept out of the
 * client `button.tsx` so server components can call it.
 */
export function buttonVariants({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], variant === "link" ? "text-sm" : sizes[size], className);
}
