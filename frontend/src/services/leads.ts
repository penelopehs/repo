// Leads API service — talks to the FastAPI lead-centric endpoints and maps the
// backend's lead-centric DTOs onto the frontend `Lead` shape used by the
// Client Dashboard (and the store that backs it).
//
// The list endpoint (GET /leads) is intentionally lean — it omits tax years,
// entity counts, and a real "latest calculation" date. To populate those table
// columns we fetch the per-lead detail aggregate (GET /leads/{id}) for each row.

import { api } from "@/services/api";
import { ALL_TAX_YEARS } from "@/types/crm";
import type { Lead, LeadSource, LeadStatus, SalesRep, TaxYear } from "@/types/crm";

// ── Backend DTOs (subset of backend/app/schemas.py we consume) ──────────────────

interface ApiLeadListItem {
  id: number;
  client_id: number | null;
  client_name: string;
  company: string | null;
  pipeline_status: string;
  lead_source: string | null;
  salesperson_name: string | null;
  client_type: string;
  latest_calc_total: number | null;
  created_at: string;
  sow_signed_at: string | null;
  engagement_started_at: string | null;
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

interface ApiLeadDetail extends ApiLeadListItem {
  email: string | null;
  phone: string | null;
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

// ── Mapping: backend detail → frontend Lead ─────────────────────────────────────

function mapDetail(d: ApiLeadDetail): Lead {
  const years = new Set<number>();
  for (const e of d.engagements ?? []) {
    for (const y of e.tax_years ?? []) years.add(y);
    for (const b of e.yearly_billing ?? []) years.add(b.year);
  }
  const taxYears = [...years]
    .filter((y) => TAX_YEARS.has(y))
    .sort((a, b) => a - b) as TaxYear[];

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
    status: STATUS_FROM_API[d.pipeline_status] ?? "new",
    engagementYears: taxYears.length,
    taxYears,
    engagedSince: d.engagement_started_at ? d.engagement_started_at.slice(0, 10) : "",
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
  /** Fetch only the lean list and return unique company names — for autocomplete. */
  async listNames(): Promise<string[]> {
    const items = await api.get<ApiLeadListItem[]>("/leads");
    const seen = new Set<string>();
    for (const i of items) {
      const name = (i.company ?? i.client_name ?? "").trim();
      if (name) seen.add(name);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  },

  /** List leads, then hydrate each with its detail aggregate (tax years,
   *  entity count, latest-calculation date) the list endpoint doesn't carry. */
  async list(): Promise<Lead[]> {
    const items = await api.get<ApiLeadListItem[]>("/leads");
    const details = await Promise.all(
      items.map((i) => api.get<ApiLeadDetail>(`/leads/${i.id}`)),
    );
    return details.map(mapDetail);
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
