// Phase Breakdown donut — shared by the live Billing Overview and the per-year
// PDF report. The print path passes `animate={false}` so the pie is fully drawn
// at screenshot time.

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/utils/format";

const PHASE_META = [
  { key: "phase1", label: "Phase 1", color: "#7dd3fc" },
  { key: "phase2", label: "Phase 2", color: "#86efac" },
  { key: "phase3", label: "Phase 3", color: "#c4b5fd" },
  { key: "phase4", label: "Phase 4", color: "#94a3b8" },
] as const;

export function PhaseDonutChart({
  phases,
  animate = true,
}: {
  phases: { phase1: number; phase2: number; phase3: number; phase4: number; total: number };
  animate?: boolean;
}) {
  const data = PHASE_META.map(({ key, label, color }) => ({
    label,
    color,
    value: phases[key],
    pct: phases.total > 0 ? (phases[key] / phases.total) * 100 : 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
      <h3 className="mb-3 text-sm font-semibold text-cyan">Phase Breakdown</h3>

      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              dataKey="value"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={animate}
            >
              {data.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(
                value: number,
                _name: string,
                props: { payload?: { label: string; pct: number } },
              ) => [
                `${formatCurrency(value)} (${props.payload?.pct.toFixed(1)}%)`,
                props.payload?.label,
              ]}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-bold text-navy tabular-nums">
            {formatCurrency(phases.total)}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="font-medium text-navy">{d.label}</span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-xs text-muted-foreground">{d.pct.toFixed(1)}%</span>
              <span className="font-semibold" style={{ color: d.color }}>
                {formatCurrency(d.value)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold text-navy">
        <span>Final Bill</span>
        <span className="tabular-nums">{formatCurrency(phases.total)}</span>
      </div>
    </div>
  );
}
