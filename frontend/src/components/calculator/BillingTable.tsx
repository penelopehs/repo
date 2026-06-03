/* eslint-disable react-refresh/only-export-components */
// Billing summary table — derives per-entity bills; "Tier" column replaced with "Years".

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCalculatorStore } from "@/store/calculatorStore";
import { FILING_STATUSES, type Entity } from "@/types/crm";
import { isStateCreditEligible } from "@/constants/states";
import { formatCurrency, toNumber } from "@/utils/format";
import { YearChips } from "@/components/MultiYearSelect";

type SortKey = "company" | "state" | "sow" | "fed" | "state_bill" | "total";

export interface BilledEntity {
  id: string;
  company: string;
  state: string;
  sow: number;
  fed: number;
  stateBill: number;
  total: number;
}

export function computeBilled(entities: Entity[], filingRate: number): BilledEntity[] {
  return entities.map((e) => {
    const qre =
      toNumber(e.w2Wages) +
      toNumber(e.contractResearch) +
      toNumber(e.supplies) +
      toNumber(e.otherQualified);
    const gross = toNumber(e.grossCredit) || qre * 0.065;
    const fed = gross * (1 - filingRate);
    const stateBill = isStateCreditEligible(e.state) ? gross * 0.18 : 0;
    const sow = Math.max(7500, gross * 0.08);
    const total = sow + fed * 0.12 + stateBill * 0.15;
    return {
      id: e.id,
      company: e.companyName || "Untitled Entity",
      state: e.state || "—",
      sow,
      fed,
      stateBill,
      total,
    };
  });
}

export function BillingTable() {
  const entities = useCalculatorStore((s) => s.entities);
  const filing = useCalculatorStore((s) => s.client.filingStatus);
  const taxYears = useCalculatorStore((s) => s.client.taxYears);
  const rate = FILING_STATUSES.find((f) => f.value === filing)?.rate ?? 0.21;

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const billed = computeBilled(entities, rate);
    const filtered = billed.filter(
      (r) =>
        r.company.toLowerCase().includes(query.toLowerCase()) ||
        r.state.toLowerCase().includes(query.toLowerCase()),
    );
    filtered.sort((a, b) => {
      const aV = a[sortKey === "state_bill" ? "stateBill" : sortKey] as string | number;
      const bV = b[sortKey === "state_bill" ? "stateBill" : sortKey] as string | number;
      const cmp =
        typeof aV === "number" && typeof bV === "number"
          ? aV - bV
          : String(aV).localeCompare(String(bV));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [entities, rate, query, sortKey, sortDir]);

  const totals = rows.reduce(
    (acc, r) => ({
      sow: acc.sow + r.sow,
      fed: acc.fed + r.fed,
      stateBill: acc.stateBill + r.stateBill,
      total: acc.total + r.total,
    }),
    { sow: 0, fed: 0, stateBill: 0, total: 0 },
  );

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${right ? "text-right" : "text-left"}`}
    >
      <button onClick={() => setSort(k)} className="inline-flex items-center gap-1 hover:text-navy">
        {label} <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </th>
  );

  if (entities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
        Generate entities above to view the billing summary.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-frost px-4 py-3">
        <h3 className="text-sm font-semibold text-navy">Entities Summary</h3>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter entities..."
          className="h-9 max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <Th k="company" label="Entity / Company" />
              <Th k="state" label="State" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Years
              </th>
              <Th k="sow" label="SOW Estimate" right />
              <Th k="fed" label="Federal Bill" right />
              <Th k="state_bill" label="State Bill" right />
              <Th k="total" label="Total" right />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-navy">{r.company}</td>
                <td className="px-4 py-3">{r.state}</td>
                <td className="px-4 py-3">
                  <YearChips years={taxYears} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.sow)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.fed)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.stateBill)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                  {formatCurrency(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gradient-frost font-semibold">
              <td colSpan={4} className="px-4 py-3 text-right text-navy">
                Totals
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-navy">
                {formatCurrency(totals.sow)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-navy">
                {formatCurrency(totals.fed)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-navy">
                {formatCurrency(totals.stateBill)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-orange">
                {formatCurrency(totals.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
