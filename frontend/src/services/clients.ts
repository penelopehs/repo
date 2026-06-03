// Clients API service — talks to the read-only GET /clients endpoint, which
// exposes the entity ↔ person ↔ role join (entity_people_roles) for the
// "Add New Lead" client autocomplete.

import { api } from "./api";

// One row of the entity_people_roles join (backend schemas.ClientContactRow).
export interface ClientContactRow {
  /** epr id (identity_people_roles) — the hidden key sent back on lead create. */
  identity_people_roles: number;
  entity_name: string;
  first_name: string;
  last_name: string;
  role_name: string;
  /** All known emails for the person — surfaced as suggestions when >1. */
  emails: string[];
  /** All known phones for the person — surfaced as suggestions when >1. */
  phones: string[];
  created_at: string | null;
}

export const clientsApi = {
  /** Substring search across first name / last name / company. Each non-empty
   *  field is sent as a filter and the backend combines them with AND. */
  async search(params: {
    firstName?: string;
    lastName?: string;
    company?: string;
  }): Promise<ClientContactRow[]> {
    const qs = new URLSearchParams();
    if (params.firstName?.trim()) qs.set("first_name", params.firstName.trim());
    if (params.lastName?.trim()) qs.set("last_name", params.lastName.trim());
    if (params.company?.trim()) qs.set("company", params.company.trim());
    const query = qs.toString();
    return api.get<ClientContactRow[]>(`/clients${query ? `?${query}` : ""}`);
  },
};
