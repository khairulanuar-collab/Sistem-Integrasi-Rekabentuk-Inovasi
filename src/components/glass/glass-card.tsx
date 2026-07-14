"use client";

import { type ReactNode, type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * GlassCard — base frosted-glass panel per PRD §5.3.
 * Variants: default | strong | dark | nav.
 */
type GlassVariant = "default" | "strong" | "dark" | "nav";

const variantClass: Record<GlassVariant, string> = {
  default: "glass",
  strong: "glass-strong",
  dark: "glass-dark",
  nav: "glass-nav",
};

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  hover?: boolean;
  padded?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = "default", hover = false, padded = true, className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantClass[variant],
          hover && "glass-hover cursor-pointer",
          padded && "p-5 sm:p-6",
          "animate-glass-in",
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

/** GlassCardHeader — title + optional action */
export function GlassCardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 size-10 rounded-xl bg-teal/20 border border-teal/35 flex items-center justify-center text-teal-soft">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base sm:text-lg text-foreground truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
