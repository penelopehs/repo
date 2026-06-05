// Billing summary table — pure UI; all math comes from calculatorEngine.ts.

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCalculatorStore } from "@/store/calculatorStore";
import type { Entity } from "@/types/crm";
import { formatCurrency } from "@/utils/format";
import { YearChips } from "@/components/MultiYearSelect";
import {
  calculateFederal,
  calculateState,
  entityFormulas,
  isEntityComplete,
} from "@/utils/calculatorEngine";

type SortKey =
  | "company"
  | "state"
  | "formula2"
  | "formula3"
  | "formula50"
  | "sow"
  | "federal"
  | "stateUtil"
  | "state_bill";

export interface BilledEntity {
  id: string;
  company: string;
  state: string;
  formula2: number;
  formula3: number;
  formula50: number;
  sow: number;
  federalShare: number;
  stateUtil: number;
  stateBill: number;
  stateUtilCap: number | null;
  stateTaxRate: number | null;
}

export function buildEntityRows(entities: Entity[]): BilledEntity[] {
  const complete = entities.filter(isEntityComplete);
  const federal = complete.length ? calculateFederal(complete).federal : 0;
  const totalSOW = complete.reduce((sum, e) => sum + entityFormulas(e).sowEstimate, 0);

  return entities.map((e) => {
    const base = {
      id: e.id,
      company: e.companyName || "Untitled Entity",
      state: e.state || "—",
    };
    if (!isEntityComplete(e)) {
      return {
        ...base,
        formula2: 0,
        formula3: 0,
        formula50: 0,
        sow: 0,
        federalShare: 0,
        stateUtil: 0,
        stateBill: 0,
        stateUtilCap: null,
        stateTaxRate: null,
      };
    }
    const f = entityFormulas(e);
    const federalShare = totalSOW > 0 ? federal * (f.sowEstimate / totalSOW) : 0;
    const st = calculateState(e.state, federalShare);
    return {
      ...base,
      formula2: f.formula2,
      formula3: f.formula3,
      formula50: f.formula50,
      sow: f.sowEstimate,
      federalShare,
      stateUtil: st.creditUtilizationAmount,
      stateBill: st.stateCreditEstimate,
      stateUtilCap: st.stateData?.utilizationCap ?? null,
      stateTaxRate: st.stateData?.taxRate ?? null,
    };
  });
}

export function BillingTable({ federalEstimate, finalBill }: { federalEstimate: number; finalBill: number }) {
  const entities = useCalculatorStore((s) => s.entities);
  const taxYears = useCalculatorStore((s) => s.client.taxYears);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sow");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const billed = buildEntityRows(entities);
    const filtered = billed.filter(
      (r) =>
        r.company.toLowerCase().includes(query.toLowerCase()) ||
        r.state.toLowerCase().includes(query.toLowerCase()),
    );
    const keyMap: Record<SortKey, keyof BilledEntity | null> = {
      company: "company",
      state: "state",
      formula2: "formula2",
      formula3: "formula3",
      formula50: "formula50",
      sow: "sow",
      federal: null,
      stateUtil: "stateUtil",
      state_bill: "stateBill",
    };
    filtered.sort((a, b) => {
      const k = keyMap[sortKey];
      if (!k) return 0;
      const aV = a[k] as string | number;
      const bV = b[k] as string | number;
      const cmp =
        typeof aV === "number" && typeof bV === "number"
          ? aV - bV
          : String(aV).localeCompare(String(bV));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [entities, query, sortKey, sortDir]);

  const totals = rows.reduce(
    (acc, r) => ({
      formula2: acc.formula2 + r.formula2,
      formula3: acc.formula3 + r.formula3,
      formula50: acc.formula50 + r.formula50,
      sow: acc.sow + r.sow,
      federalShare: acc.federalShare + r.federalShare,
      stateUtil: acc.stateUtil + r.stateUtil,
      stateBill: acc.stateBill + r.stateBill,
    }),
    { formula2: 0, formula3: 0, formula50: 0, sow: 0, federalShare: 0, stateUtil: 0, stateBill: 0 },
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
      className={`px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground ${right ? "text-right" : "text-left"}`}
    >
      <button
        onClick={() => setSort(k)}
        className={`inline-flex items-center gap-1 hover:text-navy ${right ? "justify-end" : ""}`}
      >
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
        <h3 className="text-sm font-semibold text-cyan">Entities Summary</h3>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter entities..."
          className="h-9 max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-border bg-card">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground">
                #
              </th>
              <Th k="company" label="Entity" />
              <Th k="state" label="State" />
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground">
                Years
              </th>
              <Th k="federal" label="Federal Estimate" right />
              <Th k="state_bill" label="State Estimate" right />
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-muted-foreground">
                Final Bill
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className="border-b border-border transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-navy">{r.company}</td>
                <td className="px-4 py-3">{r.state}</td>
                <td className="px-4 py-3">
                  <YearChips years={taxYears} />
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-violet">
                  {formatCurrency(r.federalShare)}
                </td>
                <td className="px-4 py-3 text-center tabular-nums font-semibold text-orange">
                  {r.stateBill > 0 ? formatCurrency(r.stateBill) : <span className="text-muted-foreground text-xs">No state credit</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-green">
                  {formatCurrency(finalBill)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gradient-frost font-semibold">
              <td colSpan={4} className="px-4 py-3 text-right text-navy">
                Totals
              </td>
              <td className="px-4 py-3 text-center tabular-nums text-violet">
                {formatCurrency(totals.federalShare)}
              </td>
              <td className="px-4 py-3 text-center tabular-nums text-orange">
                {formatCurrency(totals.stateBill)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-green">
                {formatCurrency(finalBill)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
