// Leads API service — talks to the FastAPI lead-centric endpoints and maps the
// backend's lead-centric DTOs onto the frontend `Lead` shape used by the
// Client Dashboard (and the store that backs it).
//
// The list endpoint (GET /leads) is rich: it carries every column the dashboard
// table needs (tax years, entity count, latest-calculation date, salesperson,
// client type), so the list is mapped directly — no per-row detail fetch.

import { api } from "@/services/api";
import { ALL_TAX_YEARS } from "@/types/crm";
import type {
  ClientType,
  Lead,
  LeadData,
  LeadSource,
  LeadStatus,
  SalesRep,
  TaxYear,
} from "@/types/crm";

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
  // Per-lead aggregate (people, entities, calculations-by-year). Matches LeadData.
  data: LeadData | null;
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

// The backend `data` column is free-form JSON and can be null or (when cleared)
// an array. Normalise it to a well-formed LeadData so consumers can rely on it.
function normalizeData(data: LeadData | null | undefined): LeadData {
  if (!data || Array.isArray(data)) {
    return { people: [], entities: [], calculations: {} };
  }
  return {
    people: Array.isArray(data.people) ? data.people : [],
    entities: Array.isArray(data.entities) ? data.entities : [],
    calculations:
      data.calculations && typeof data.calculations === "object" ? data.calculations : {},
  };
}

// ── Mapping: backend list item → frontend Lead ──────────────────────────────────
//
// The list response is self-contained, so the dashboard table is filled entirely
// from a single GET /leads (no per-row detail fetch).

function mapListItem(i: ApiLeadListItem): Lead {
  const taxYears = toTaxYears(i.tax_years);
  const data = normalizeData(i.data);
  // Entity names live in the `data` aggregate; surface them for the dashboard
  // table and the client profile's Entities card.
  const entityNames = data.entities
    .map((e) => e.name)
    .filter((n): n is string => Boolean(n && n.trim()));

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
    entitiesCount: i.entities_count ?? entityNames.length,
    entityNames,
    data,
    // latest_calc_date is Unix epoch seconds; render to an ISO date string.
    latestCalculation:
      i.latest_calc_date != null
        ? new Date(i.latest_calc_date * 1000).toISOString().slice(0, 10)
        : "—",
    addedAt: i.created_at,
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

  /** Fetch a single lead (GET /leads/{id}). The detail response is a superset
   *  of the list item, so the same mapper applies. Used to hydrate the client
   *  profile on a direct page load when the list isn't in memory yet. */
  async get(id: string): Promise<Lead> {
    const item = await api.get<ApiLeadListItem>(`/leads/${id}`);
    return mapListItem(item);
  },

  async create(input: LeadCreateInput): Promise<Lead> {
    // `client_name` makes the backend provision a client account up-front.
    // POST /leads echoes back the created lead in the same shape as the list
    // endpoint, so the new row is built straight from the response.
    const item = await api.post<ApiLeadListItem>("/leads", {
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
    return mapListItem(item);
  },

  async update(id: string, patch: Partial<Lead>): Promise<Lead> {
    const body: Record<string, unknown> = {};
    if (patch.company !== undefined) body.company = patch.company;
    if (patch.email !== undefined) body.email = patch.email;
    if (patch.phone !== undefined) body.phone = patch.phone;
    if (patch.source !== undefined) body.lead_source = patch.source;
    if (patch.status !== undefined) body.pipeline_status = STATUS_TO_API[patch.status];
    if (patch.notes !== undefined) body.notes = patch.notes;
    if (patch.data !== undefined) body.data = patch.data;
    if (patch.fullName !== undefined) body.full_name = patch.fullName;
    if (patch.rep !== undefined) body.rep = patch.rep;

    // PATCH returns the updated lead in the same shape as the list endpoint.
    const item = await api.patch<ApiLeadListItem>(`/leads/${id}`, body);
    return mapListItem(item);
  },

  async remove(id: string): Promise<void> {
    await api.delete<void>(`/leads/${id}`);
  },
};
