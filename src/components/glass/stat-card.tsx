"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * StatCard — PRD §5.3, §7.1: kad ringkasan statistik with icon & trend.
 */
export function StatCard({
  label,
  value,
  icon,
  hint,
  trend,
  trendDirection = "neutral",
  accent = "teal",
  className,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  accent?: "teal" | "gold" | "navy" | "red" | "green";
  className?: string;
}) {
  const accentBg: Record<string, string> = {
    teal: "bg-teal/22 border-teal/40 text-teal-soft",
    gold: "bg-gold/22 border-gold/40 text-gold",
    navy: "bg-navy-soft/40 border-white/15 text-blue-100",
    red: "bg-red-500/22 border-red-500/40 text-red-300",
    green: "bg-emerald-500/22 border-emerald-500/40 text-emerald-300",
  };
  const TrendIcon = trendDirection === "up" ? TrendingUp : trendDirection === "down" ? TrendingDown : Minus;
  const trendColor = trendDirection === "up" ? "text-emerald-300" : trendDirection === "down" ? "text-red-300" : "text-muted-foreground";
  return (
    <div className={cn("glass p-4 sm:p-5 animate-glass-in flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between">
        <div className={cn("size-10 rounded-xl border flex items-center justify-center", accentBg[accent])}>
          {icon}
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
            <TrendIcon className="size-3.5" />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">
          {value}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
