"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { forwardRef, type ComponentProps } from "react";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button-variants";

export interface ButtonProps extends Omit<ComponentProps<typeof BaseButton>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type, ...props },
  ref,
) {
  return <BaseButton ref={ref} type={type ?? "button"} className={buttonVariants({ variant, size, className })} {...props} />;
});
