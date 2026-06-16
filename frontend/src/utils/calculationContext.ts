import type { Lead, TaxYear } from "@/types/crm";
import { ALL_TAX_YEARS } from "@/types/crm";

export function hasExistingCalculation(lead: Pick<Lead, "latestCalculation">) {
  return typeof lead.latestCalculation === "string" && lead.latestCalculation.trim() !== "—";
}

// The tax years a lead has calculations for live as the keys of
// `data.calculations` (e.g. "2021"). Parse them into sorted, valid TaxYears so
// the calculator can show them as the selected years.
export function calculationYears(lead: Pick<Lead, "data">): TaxYear[] {
  const calcs = lead.data?.calculations ?? {};
  return Object.keys(calcs)
    .map(Number)
    .filter((y): y is TaxYear => ALL_TAX_YEARS.includes(y as TaxYear))
    .sort((a, b) => a - b);
}

// Lead ids are numeric strings (the backend id is a number). Carry leadId as a
// number so the router serializes it as `?leadId=6` rather than JSON-quoting a
// string into `?leadId="6"`.
export function buildCalculationSearch(lead: Pick<Lead, "id">) {
  return { leadId: Number(lead.id) };
}
