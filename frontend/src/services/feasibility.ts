import { api } from "@/services/api";
import type { FeasibilityEntity } from "@/types/feasibility";

export interface FeasibilityCallPayload {
  call_setup: unknown;
  components: unknown;
  generated_output?: unknown;
  status?: string;
  current_step?: number | null;
}

export type FeasibilityCallUpdatePayload = Partial<FeasibilityCallPayload>;

export interface FeasibilityCallRecord {
  id: number;
  crm_leads_id: number;
  call_setup: unknown;
  components: unknown;
  generated_output?: unknown;
  status: string;
  current_step?: number | null;
  created_at: string;
  updated_at: string;
}

export const feasibilityApi = {
  async searchEntities(query: string): Promise<FeasibilityEntity[]> {
    return api.get<FeasibilityEntity[]>(`/feasibility/entities?q=${encodeURIComponent(query)}`);
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
    return api.post<FeasibilityEntity>(`/leads/${leadId}/feasibility/entities`, data);
  },

  async listDrafts(leadId: string): Promise<FeasibilityCallRecord[]> {
    return api.get<FeasibilityCallRecord[]>(`/leads/${leadId}/feasibility-calls?status=draft`);
  },

  async createDraft(leadId: string, data: FeasibilityCallPayload): Promise<FeasibilityCallRecord> {
    return api.post<FeasibilityCallRecord>(`/leads/${leadId}/feasibility-calls`, data);
  },

  async updateDraft(
    leadId: string,
    callId: string,
    data: FeasibilityCallUpdatePayload,
  ): Promise<FeasibilityCallRecord> {
    return api.patch<FeasibilityCallRecord>(`/leads/${leadId}/feasibility-calls/${callId}`, data);
  },

  async deleteDraft(leadId: string, callId: string): Promise<void> {
    return api.delete<void>(`/leads/${leadId}/feasibility-calls/${callId}`);
  },

  // Final submission — persisted as a separate "submitted" record, leaving the
  // working draft intact.
  async saveFeasibilityCall(
    leadId: string,
    data: FeasibilityCallPayload,
  ): Promise<FeasibilityCallRecord> {
    return api.post<FeasibilityCallRecord>(`/leads/${leadId}/feasibility-calls`, {
      ...data,
      status: "submitted",
    });
  },
};
