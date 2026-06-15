import { api } from "@/services/api";
import type { FeasibilityEntity } from "@/types/feasibility";

export interface FeasibilityCallPayload {
  call_setup: unknown;
  components: unknown;
  generated_output?: unknown;
}

export interface FeasibilityCallRecord {
  id: number;
  crm_leads_id: number;
  call_setup: unknown;
  components: unknown;
  generated_output?: unknown;
  created_at: string;
  updated_at: string;
}

export const feasibilityApi = {
  async searchEntities(query: string): Promise<FeasibilityEntity[]> {
    return api.get<FeasibilityEntity[]>(
      `/feasibility/entities?q=${encodeURIComponent(query)}`,
    );
  },

  async createEntity(
    leadId: string,
    data: {
      name: string;
      entity_type?: string;
      city?: string;
      state?: string;
      ein?: string;
    },
  ): Promise<FeasibilityEntity> {
    return api.post<FeasibilityEntity>(
      `/leads/${leadId}/feasibility/entities`,
      data,
    );
  },

  async saveFeasibilityCall(
    leadId: string,
    data: FeasibilityCallPayload,
  ): Promise<FeasibilityCallRecord> {
    return api.post<FeasibilityCallRecord>(
      `/leads/${leadId}/feasibility-calls`,
      data,
    );
  },
};