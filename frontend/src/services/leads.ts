// Leads API service — talks to the FastAPI lead-centric endpoints and maps the
// backend's lead-centric DTOs onto the frontend `Lead` shape used by the
// Client Dashboard (and the store that backs it).
//
// The list endpoint (GET /leads) is rich: it carries every column the dashboard
// table needs (tax years, entity count, latest-calculation date, salesperson,
// client type), so the list is mapped directly — no per-row detail fetch.

import { api } from "@/services/api";
import { ALL_TAX_YEARS } from "@/types/crm";
import type { ClientType, Lead, LeadSource, LeadStatus, SalesRep, TaxYear } from "@/types/crm";

// ── Backend DTOs (subset of backend/app/schemas.py we consume) ──────────────────

interface ApiLeadListItem {
  id: number;
  company: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  pipeline_status: string;
  lead_source: string | null;
  salesperson_iduser: number | null;
  salesperson_name: string | null;
  client_type: string; // "New" | "Returning"
  /** Unix epoch seconds (Python datetime.timestamp()), null if no calculation. */
  latest_calc_date: number | null;
  created_at: string;
  sow_signed_at: string | null;
  engagement_started_at: string | null;
  entities_count: number;
  tax_years: number[];
}

interface ApiContact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

interface ApiEngagement {
  id: number;
  tax_years: number[];
  yearly_billing: { year: number; billing_amount: number }[];
}

interface ApiCalculation {
  id: number;
  created_at: string;
}

// The per-lead detail aggregate (GET /leads/{id}, and the POST/PATCH responses).
interface ApiLeadDetail {
  id: number;
  company: string | null;
  client_name?: string | null;
  email: string | null;
  phone: string | null;
  pipeline_status: string;
  lead_source: string | null;
  salesperson_iduser?: number | null;
  salesperson_name: string | null;
  client_type?: string | null;
  created_at: string;
  sow_signed_at?: string | null;
  engagement_started_at: string | null;
  notes: string | null;
  sub_entities: { id: number }[];
  contacts: ApiContact[];
  engagements: ApiEngagement[];
  calculations: ApiCalculation[];
}

// ── Status mapping (frontend snake_case ⇄ backend Title Case enum) ──────────────

const STATUS_FROM_API: Record<string, LeadStatus> = {
  Lead: "new",
  "Calculation Sent": "calculation_sent",
  "SOW Signed": "sow_signed",
  "Active Engagement": "active_engagement",
};

const STATUS_TO_API: Record<LeadStatus, string> = {
  new: "Lead",
  calculation_sent: "Calculation Sent",
  sow_signed: "SOW Signed",
  active_engagement: "Active Engagement",
  lost: "Lost", // no backend enum value yet — sent as-is for the future update.
};

const TAX_YEARS = new Set<number>(ALL_TAX_YEARS);

const toTaxYears = (years: number[] | null | undefined): TaxYear[] =>
  [...new Set(years ?? [])]
    .filter((y) => TAX_YEARS.has(y))
    .sort((a, b) => a - b) as TaxYear[];

const toClientType = (v: string | null | undefined): ClientType =>
  v === "Returning" ? "Returning" : "New";

const isoDate = (v: string | null | undefined): string => (v ? v.slice(0, 10) : "");

// ── Mapping: backend list item → frontend Lead ──────────────────────────────────
//
// The list response is self-contained, so the dashboard table is filled entirely
// from a single GET /leads (no per-row detail fetch).

function mapListItem(i: ApiLeadListItem): Lead {
  const taxYears = toTaxYears(i.tax_years);

  return {
    id: String(i.id),
    fullName: i.full_name ?? "",
    company: i.company ?? "",
    email: i.email ?? "",
    phone: i.phone ?? "",
    source: (i.lead_source ?? "Other") as LeadSource,
    rep: i.salesperson_name ?? "Unassigned",
    repId: i.salesperson_iduser ?? null,
    status: STATUS_FROM_API[i.pipeline_status] ?? "new",
    clientType: toClientType(i.client_type),
    engagementYears: taxYears.length,
    taxYears,
    engagedSince: isoDate(i.engagement_started_at),
    sowSignedAt: isoDate(i.sow_signed_at) || undefined,
    entitiesCount: i.entities_count ?? 0,
    // latest_calc_date is Unix epoch seconds; render to an ISO date string.
    latestCalculation:
      i.latest_calc_date != null
        ? new Date(i.latest_calc_date * 1000).toISOString().slice(0, 10)
        : "—",
    addedAt: i.created_at,
  };
}

// ── Mapping: backend detail → frontend Lead ─────────────────────────────────────

function mapDetail(d: ApiLeadDetail): Lead {
  const years = new Set<number>();
  for (const e of d.engagements ?? []) {
    for (const y of e.tax_years ?? []) years.add(y);
    for (const b of e.yearly_billing ?? []) years.add(b.year);
  }
  const taxYears = toTaxYears([...years]);

  // calculations come back newest-first from the backend.
  const latestCalc = d.calculations?.[0];
  // Prefer a contact that has an email (the backend's own preference order).
  const primaryContact = d.contacts?.find((c) => c.email) ?? d.contacts?.[0];

  return {
    id: String(d.id),
    fullName: primaryContact?.name ?? "",
    company: d.company ?? d.client_name ?? "",
    email: d.email ?? primaryContact?.email ?? "",
    phone: d.phone ?? primaryContact?.phone ?? "",
    source: (d.lead_source ?? "Other") as LeadSource,
    rep: (d.salesperson_name ?? "Unassigned") as SalesRep,
    repId: d.salesperson_iduser ?? null,
    status: STATUS_FROM_API[d.pipeline_status] ?? "new",
    clientType: toClientType(d.client_type),
    engagementYears: taxYears.length,
    taxYears,
    engagedSince: isoDate(d.engagement_started_at),
    sowSignedAt: isoDate(d.sow_signed_at) || undefined,
    entitiesCount: d.sub_entities?.length ?? 0,
    latestCalculation: latestCalc ? latestCalc.created_at.slice(0, 10) : "—",
    addedAt: d.created_at,
    notes: d.notes ?? undefined,
  };
}

// ── Inputs from the dashboard dialogs ───────────────────────────────────────────

export interface LeadCreateInput {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  rep: SalesRep;
  /** epr id (identity_people_roles) of a picked existing client, if any. */
  eprId?: number | null;
  taxYears?: TaxYear[];
}

// ── Public API ──────────────────────────────────────────────────────────────────

export const leadsApi = {
  /** Fetch the list and return unique company names — for autocomplete. */
  async listNames(): Promise<string[]> {
    const items = await api.get<ApiLeadListItem[]>("/leads");
    const seen = new Set<string>();
    for (const i of items) {
      const name = (i.company ?? i.full_name ?? "").trim();
      if (name) seen.add(name);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  },

  /** List leads for the dashboard table — a single request that already carries
   *  tax years, entity count, latest-calculation date, and salesperson. */
  async list(): Promise<Lead[]> {
    const items = await api.get<ApiLeadListItem[]>("/leads");
    return items.map(mapListItem);
  },

  async create(input: LeadCreateInput): Promise<Lead> {
    // `client_name` makes the backend provision a client account up-front.
    // full_name / rep / tax_years are sent for the planned backend update;
    // the current LeadCreate schema simply ignores unknown fields.
    const detail = await api.post<ApiLeadDetail>("/leads", {
      client_name: input.company,
      company: input.company,
      email: input.email,
      phone: input.phone,
      lead_source: input.source,
      first_name: input.firstName,
      last_name: input.lastName,
      full_name: `${input.firstName} ${input.lastName}`.trim(),
      // epr_id of the selected existing client (null for a brand-new person).
      epr_id: input.eprId ?? null,
      rep: input.rep,
      tax_years: input.taxYears ?? [],
    });
    return mapDetail(detail);
  },

  async update(id: string, patch: Partial<Lead>): Promise<Lead> {
    const body: Record<string, unknown> = {};
    if (patch.company !== undefined) body.company = patch.company;
    if (patch.email !== undefined) body.email = patch.email;
    if (patch.phone !== undefined) body.phone = patch.phone;
    if (patch.source !== undefined) body.lead_source = patch.source;
    if (patch.status !== undefined) body.pipeline_status = STATUS_TO_API[patch.status];
    if (patch.notes !== undefined) body.notes = patch.notes;
    // Extras the backend ignores today (sent for the planned update).
    if (patch.fullName !== undefined) body.full_name = patch.fullName;
    if (patch.rep !== undefined) body.rep = patch.rep;

    const detail = await api.patch<ApiLeadDetail>(`/leads/${id}`, body);
    return mapDetail(detail);
  },

  async remove(id: string): Promise<void> {
    await api.delete<void>(`/leads/${id}`);
  },
};
