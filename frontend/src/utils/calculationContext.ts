import type { Lead } from "@/types/crm";

export function hasExistingCalculation(lead: Pick<Lead, "latestCalculation">) {
  return typeof lead.latestCalculation === "string" && lead.latestCalculation.trim() !== "—";
}

export function buildCalculationSearch(
  lead: Pick<Lead, "company" | "taxYears" | "latestCalculation">,
) {
  return {
    clientName: lead.company,
    taxYears: lead.taxYears.join(","),
    latestCalculation: lead.latestCalculation,
    hasExistingCalculation: hasExistingCalculation(lead),
  };
}
