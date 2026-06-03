// Enterprise KPI card with animated counter, subtitle, and accent gradients.

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useAnimatedCount } from "@/hooks/useAnimatedCount";
import { formatCurrency, formatNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

type Accent = "navy" | "orange" | "cyan" | "green" | "violet";

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: Accent;
  currency?: boolean;
  subtitle?: string;
  labelClassName?: string;
  compact?: boolean;
  mini?: boolean;
}

const accentMap: Record<Accent, { bg: string; text: string; ring: string }> = {
  navy: { bg: "bg-navy/10", text: "text-navy", ring: "ring-navy/20" },
  orange: { bg: "bg-gradient-orange", text: "text-orange-foreground", ring: "ring-orange/20" },
  cyan: { bg: "bg-gradient-cyan", text: "text-cyan-foreground", ring: "ring-cyan/20" },
  green: { bg: "bg-green", text: "text-green-foreground", ring: "ring-green/20" },
  violet: { bg: "bg-violet", text: "text-violet-foreground", ring: "ring-violet/20" },
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "navy",
  currency = false,
  subtitle,
  labelClassName,
  compact = false,
  mini = false,
}: KpiCardProps) {
  const animated = useAnimatedCount(value);
  const a = accentMap[accent];

  const padding = mini ? "p-2.5" : compact ? "p-4" : "p-5";
  const numSize = mini ? "text-lg" : compact ? "text-2xl" : "text-3xl";
  const numMt = mini ? "mt-0.5" : "mt-2";
  const iconBox = mini ? "h-7 w-7" : compact ? "h-9 w-9" : "h-11 w-11";
  const iconSize = mini ? "h-3.5 w-3.5" : compact ? "h-4 w-4" : "h-5 w-5";
  const labelCls = mini ? "text-[10px]" : "text-xs";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-hover",
        padding,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              labelCls,
              "font-semibold uppercase tracking-wider",
              labelClassName || "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p className={cn(numMt, "font-bold tabular-nums text-navy", numSize)}>
            {currency ? formatCurrency(animated) : formatNumber(Math.round(animated))}
          </p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
            iconBox,
            a.bg,
            a.text,
            a.ring,
          )}
        >
          <Icon className={iconSize} />
        </div>
      </div>
      <div className={cn("absolute inset-x-0 bottom-0 h-0.5 opacity-70", a.bg)} />
    </motion.div>
  );
}
