"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium tracking-wide select-none transition-[background-color,border-color,box-shadow,color] duration-100 focus-ring disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    // Dark outer edge, a 1px light inner border just inside it, then a soft drop shadow.
    "bg-brand-vertical text-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.22),inset_0_0_0_2px_rgb(255_255_255/0.18),var(--shadow-sm)] transition-[filter,box-shadow] hover:brightness-110 active:brightness-95",
  secondary:
    "bg-bg text-fg ring-1 ring-inset ring-border-strong shadow-xs hover:bg-bg-hover data-popup-open:bg-bg-hover",
  ghost: "text-fg-secondary hover:bg-bg-hover hover:text-fg data-popup-open:bg-bg-hover data-popup-open:text-fg",
  danger:
    "bg-danger text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(16_17_19/0.12)] ring-1 ring-inset ring-[color-mix(in_oklch,var(--danger),black_14%)] hover:bg-danger-hover",
  "danger-ghost": "text-danger-fg hover:bg-danger-subtle",
  link: "h-auto px-0 text-accent-fg hover:underline underline-offset-2",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-xs [&_svg]:size-3.5",
  sm: "h-8 px-2.5 text-sm [&_svg]:size-4",
  md: "h-9 px-3 text-sm [&_svg]:size-4",
  lg: "h-10 px-4 text-base [&_svg]:size-[18px]",
};

const iconSizes: Record<ButtonSize, string> = {
  xs: "size-7 [&_svg]:size-3.5",
  sm: "size-8 [&_svg]:size-4",
  md: "size-9 [&_svg]:size-[18px]",
  lg: "size-10 [&_svg]:size-5",
};

export function buttonVariants({
  variant = "secondary",
  size = "sm",
  icon = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; icon?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], icon ? iconSizes[size] : variant === "link" ? "text-sm" : sizes[size], className);
}

export interface ButtonProps extends Omit<ComponentProps<typeof BaseButton>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon-only button. Pass an aria-label. */
  icon?: boolean;
  loading?: boolean;
  className?: string;
  /** Keyboard hint rendered at the end, e.g. "⌘↵". */
  kbd?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", icon = false, loading, disabled, className, children, kbd, type, ...props },
  ref,
) {
  return (
    <BaseButton
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      className={buttonVariants({ variant, size, icon, className })}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
      {kbd ? (
        <span
          className={cn(
            "-mr-0.5 ml-1 inline-flex h-[18px] items-center rounded-[4px] px-1.5 text-[11px] font-medium leading-none",
            variant === "primary" || variant === "danger" ? "bg-white/20 text-white" : "bg-bg-muted text-fg-tertiary",
          )}
        >
          {kbd}
        </span>
      ) : null}
    </BaseButton>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-3.5 animate-spin", className)} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
