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
}

const accentMap: Record<Accent, { bg: string; text: string; ring: string }> = {
  navy:   { bg: "bg-gradient-navy",   text: "text-navy-foreground",   ring: "ring-navy/10" },
  orange: { bg: "bg-gradient-orange", text: "text-orange-foreground", ring: "ring-orange/20" },
  cyan:   { bg: "bg-gradient-cyan",   text: "text-cyan-foreground",   ring: "ring-cyan/20" },
  green:  { bg: "bg-green",           text: "text-green-foreground",  ring: "ring-green/20" },
  violet: { bg: "bg-violet",          text: "text-violet-foreground", ring: "ring-violet/20" },
};

export function KpiCard({ label, value, icon: Icon, accent = "navy", currency = false, subtitle, labelClassName }: KpiCardProps) {
  const animated = useAnimatedCount(value);
  const a = accentMap[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold uppercase tracking-wider", labelClassName || "text-muted-foreground")}>
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-navy">
            {currency ? formatCurrency(animated) : formatNumber(Math.round(animated))}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg ring-1 ring-inset", a.bg, a.text, a.ring)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className={cn("absolute inset-x-0 bottom-0 h-0.5 opacity-70", a.bg)} />
    </motion.div>
  );
}
