import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border border-accent-deep bg-accent-deep text-paper-high hover:bg-[#85200f] hover:border-[#85200f]",
  secondary:
    "border border-white/20 bg-ink-raised text-copy hover:border-white/35 hover:bg-ink-soft",
  ghost:
    "border border-transparent bg-transparent text-copy-secondary hover:border-white/20 hover:bg-white/[0.06] hover:text-copy",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-xs",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-sm",
};

export function Button({
  asChild = false,
  children,
  className,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition duration-base ease-authored focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-shell active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      type={asChild ? undefined : type}
      {...props}
    >
      {children}
    </Component>
  );
}
