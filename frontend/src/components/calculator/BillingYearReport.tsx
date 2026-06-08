// Presentational, store-free billing overview for a single tax year. Rendered
// off-screen (one per year) and screenshotted into the multi-page PDF export.
// Mirrors the live Billing Overview section in CalculatorPage.

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BillingTable } from "@/components/calculator/BillingTable";
import { PhaseDonutChart } from "@/components/calculator/PhaseDonutChart";
import type { Entity, TaxYear } from "@/types/crm";
import { formatCurrency } from "@/utils/format";
import {
  type BillingTotals,
  type EngagementCalculation,
  isEntityComplete,
} from "@/utils/calculatorEngine";

interface Props {
  clientName: string;
  year: TaxYear;
  entities: Entity[];
  result: EngagementCalculation | null;
  totals: BillingTotals;
  notes: string;
}

export function BillingYearReport({ clientName, year, entities, result, totals, notes }: Props) {
  const completeEntities = entities.filter(isEntityComplete);
  const outOfRange = result?.tier === "Out of Range";
  const isCustom = result?.tier === "Custom";
  const federalDisplay = !result || result.federal === 0;

  // Single source of truth for the Final Bill KPI (value + optional message),
  // matching the live page's logic.
  const finalBill: { value: string | null; message: string | null } = (() => {
    if (!result || federalDisplay || outOfRange) return { value: null, message: null };
    if (result.billing) return { value: formatCurrency(result.billing.finalBill), message: null };
    if (isCustom) {
      return { value: null, message: "Custom tier — contact the processing team for pricing." };
    }
    return { value: null, message: null };
  })();

  const kpis = [
    { label: "Federal Total", value: formatCurrency(totals.federalCreditEstimate), message: null, color: "text-violet" },
    { label: "State Total", value: formatCurrency(totals.stateTotal), message: null, color: "text-green" },
    {
      label: "Final Bill",
      value: finalBill.value ?? (finalBill.message ? null : formatCurrency(totals.finalBill)),
      message: finalBill.message,
      color: "text-orange",
    },
  ];

  return (
    <div className="bg-card p-6">
      <h2 className="mb-5 text-base font-semibold text-navy">
        Billing Overview Summary — {year}
      </h2>

      <div className="flex flex-col gap-6 rounded-xl border border-border bg-gradient-frost p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Overview</p>
          <h3 className="mt-1 text-xl font-bold text-navy">{clientName || "Untitled Client"}</h3>
          <div className="mt-1 flex flex-wrap items-center text-sm text-muted-foreground">
            <span className="font-medium text-navy">{year}</span>
            <span className="mx-2 opacity-50">·</span>
            <span>
              {entities.length} {entities.length === 1 ? "entity" : "entities"}
            </span>
            {result?.tier && (
              <>
                <span className="mx-2 opacity-50">·</span>
                <Badge variant="secondary">{result.tier}</Badge>
              </>
            )}
          </div>
        </div>
        <div className="grid w-full gap-x-8 gap-y-4 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-wider ${kpi.color}`}>{kpi.label}</p>
              {kpi.value && (
                <p className={`mt-1 text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              )}
              {kpi.message && <p className="mt-1 text-xs text-muted-foreground">{kpi.message}</p>}
            </div>
          ))}
        </div>
      </div>

      {outOfRange && completeEntities.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          Federal Credit Estimate below $6,000 minimum. Please review inputs.
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BillingTable
            entities={entities}
            taxYears={[year]}
            federalEstimate={totals.federalCreditEstimate}
            finalBill={totals.finalBill}
          />
        </div>
        {result?.phases && result.billing && (
          <PhaseDonutChart phases={result.phases} animate={false} />
        )}
      </div>

      {entities.some((e) => e.owners.length > 0) && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
            <Users className="h-4 w-4 text-violet" /> Ownership Breakdown by Entity
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entities
              .filter((e) => e.owners.length > 0)
              .map((e) => {
                const total = e.owners.reduce(
                  (sum, o) => sum + (typeof o.ownershipPct === "number" ? o.ownershipPct : 0),
                  0,
                );
                return (
                  <div key={e.id} className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-3 truncate text-xs font-semibold uppercase tracking-wider text-violet">
                      {e.companyName || "Untitled Entity"}
                    </p>
                    <div className="space-y-2">
                      {e.owners.map((o) => {
                        const pct = typeof o.ownershipPct === "number" ? o.ownershipPct : 0;
                        const name = `${o.firstName} ${o.lastName}`.trim() || "Unnamed";
                        return (
                          <div key={o.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-navy">{name}</p>
                              {o.role && (
                                <p className="truncate text-[10px] text-muted-foreground">{o.role}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-violet/60"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="w-10 text-right text-xs font-semibold tabular-nums text-violet">
                                {pct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`mt-3 flex items-center justify-between border-t border-border pt-2 text-xs font-semibold ${total > 100 ? "text-destructive" : total === 100 ? "text-green" : "text-navy"}`}>
                      <span>Total</span>
                      <span className="tabular-nums">{total}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {notes.trim() && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-navy">Notes</h3>
          <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-navy">
            {notes}
          </p>
        </div>
      )}
    </div>
  );
}
