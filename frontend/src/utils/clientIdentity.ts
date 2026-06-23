import type { Lead, TaxYear } from "@/types/crm";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Entity names surfaced on a lead (list + data.entities). */
export function entityNamesFor(lead: Lead): string[] {
  const fromList = lead.entityNames ?? [];
  const fromData = (lead.data?.entities ?? []).map((e) => e.name?.trim() ?? "").filter(Boolean);
  return [...new Set([...fromList, ...fromData].map((n) => n.trim()).filter(Boolean))];
}

function contactMatch(a: Lead, b: Lead): boolean {
  const ap = normalizePhone(a.phone);
  const bp = normalizePhone(b.phone);
  if (ap.length > 0 && ap === bp) return true;
  const ae = normalizeEmail(a.email);
  const be = normalizeEmail(b.email);
  return ae.length > 0 && ae === be;
}

function entityMatch(a: Lead, b: Lead): boolean {
  const aNames = entityNamesFor(a);
  const bNames = entityNamesFor(b);
  if (aNames.length === 0 || bNames.length === 0) return false;
  return aNames.some((an) => bNames.includes(an));
}

/** True when two leads share client name, at least one entity, and phone or email. */
export function leadsMatch(a: Lead, b: Lead): boolean {
  if (a.id === b.id) return true;
  if (a.fullName !== b.fullName) return false;
  if (!entityMatch(a, b)) return false;
  return contactMatch(a, b);
}

/** All leads in the same identity cluster (transitive matches). */
export function getClientCluster(lead: Lead, allLeads: Lead[]): Lead[] {
  const byId = new Map(allLeads.map((l) => [l.id, l]));
  const visited = new Set<string>();
  const queue = [lead.id];

  while (queue.length > 0) {
    const id = queue.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const current = byId.get(id);
    if (!current) continue;
    for (const other of allLeads) {
      if (!visited.has(other.id) && leadsMatch(current, other)) {
        queue.push(other.id);
      }
    }
  }

  return allLeads.filter((l) => visited.has(l.id));
}

/** Stable profile id: earliest added record, then lowest numeric id. */
export function canonicalLeadId(lead: Lead, allLeads: Lead[]): string {
  const cluster = getClientCluster(lead, allLeads);
  const sorted = [...cluster].sort((a, b) => {
    const ta = new Date(a.addedAt).getTime();
    const tb = new Date(b.addedAt).getTime();
    if (ta !== tb) return ta - tb;
    return Number(a.id) - Number(b.id);
  });
  return sorted[0]?.id ?? lead.id;
}

function latestCalculationDate(leads: Lead[]): string {
  const dates = leads.map((l) => l.latestCalculation).filter((d) => d && d !== "—");
  if (dates.length === 0) return "—";
  return dates.sort().at(-1)!;
}

/** Merge cluster records for read-only profile display; mutations use canonical id. */
export function mergeLeadsForDisplay(cluster: Lead[], canonicalId: string): Lead {
  const primary = cluster.find((l) => l.id === canonicalId) ?? cluster[0];
  if (!primary || cluster.length <= 1) return primary;

  const taxYears = [...new Set(cluster.flatMap((l) => l.taxYears))].sort(
    (a, b) => a - b,
  ) as TaxYear[];

  const entityNames = [...new Set(cluster.flatMap((l) => entityNamesFor(l)))];
  const engagements = cluster.flatMap((l) => l.engagements ?? []);

  return {
    ...primary,
    taxYears,
    entityNames,
    entitiesCount: Math.max(...cluster.map((l) => l.entitiesCount), entityNames.length),
    engagementYears: taxYears.length,
    latestCalculation: latestCalculationDate(cluster),
    engagements,
  };
}

export type ClientRecordSnapshot = {
  leadId: string;
  taxYears: TaxYear[];
  rep: string;
  latestCalculation: string;
  nextCallLabel: string;
  addedAt: string;
};

export function clientRecordSnapshots(cluster: Lead[]): ClientRecordSnapshot[] {
  return cluster.map((l) => ({
    leadId: l.id,
    taxYears: l.taxYears,
    rep: l.rep,
    latestCalculation: l.latestCalculation,
    nextCallLabel: formatNextCallLabel(l),
    addedAt: l.addedAt,
  }));
}

function formatNextCallLabel(lead: Lead): string {
  const nc = lead.nextCall;
  if (nc) {
    const type = nc.callType ? ` · ${nc.callType}` : "";
    return `${nc.date}${type}`;
  }
  return "—";
}
