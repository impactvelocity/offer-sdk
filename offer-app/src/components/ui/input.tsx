"use client";

import { Input as BaseInput } from "@base-ui/react/input";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full min-w-0 rounded-md border border-border-input bg-bg text-sm text-fg shadow-xs outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-fg-placeholder hover:border-border-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-fg-tertiary data-invalid:border-danger data-invalid:focus:shadow-[0_0_0_3px_rgb(229_72_77/0.2)] read-only:bg-bg-subtle read-only:focus:border-border-input read-only:focus:shadow-none";

export interface InputProps extends Omit<ComponentProps<typeof BaseInput>, "size" | "className"> {
  size?: "sm" | "md";
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ size = "md", className, ...props }, ref) {
  return <BaseInput ref={ref} className={cn(field, size === "sm" ? "h-8 px-2.5" : "h-9 px-3", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(field, "resize-y px-3 py-2 leading-[22px]", className)} {...props} />;
});

/** Input with a leading and/or trailing adornment (icon, prefix text, button). */
export const InputGroup = forwardRef<
  HTMLInputElement,
  InputProps & { leading?: ReactNode; trailing?: ReactNode; wrapperClassName?: string }
>(function InputGroup({ leading, trailing, wrapperClassName, className, ...props }, ref) {
  return (
    <div className={cn("relative flex items-center", wrapperClassName)}>
      {leading ? (
        <span className="pointer-events-none absolute left-3 flex items-center text-fg-icon [&_svg]:size-4">
          {leading}
        </span>
      ) : null}
      <Input ref={ref} className={cn(leading && "pl-9", trailing && "pr-10", className)} {...props} />
      {trailing ? <span className="absolute right-1 flex items-center">{trailing}</span> : null}
    </div>
  );
});
