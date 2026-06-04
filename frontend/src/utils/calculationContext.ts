import type { Lead } from "@/types/crm";

export function hasExistingCalculation(lead: Pick<Lead, "latestCalculation">) {
  return typeof lead.latestCalculation === "string" && lead.latestCalculation.trim() !== "—";
}

// Lead ids are numeric strings (the backend id is a number). Carry leadId as a
// number so the router serializes it as `?leadId=6` rather than JSON-quoting a
// string into `?leadId="6"`.
export function buildCalculationSearch(lead: Pick<Lead, "id">) {
  return { leadId: Number(lead.id) };
}
