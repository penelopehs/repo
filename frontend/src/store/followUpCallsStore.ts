// Follow-up calls store — API-backed, keyed by lead id. Backs the client
// profile's "Follow-up Calls" card (services/followUpCalls.ts).

import { create } from "zustand";
import type { FollowUpCall } from "@/types/crm";
import {
  followUpCallsApi,
  type FollowUpCallCreateInput,
  type FollowUpCallPatch,
} from "@/services/followUpCalls";

interface FollowUpCallsState {
  byLead: Record<string, FollowUpCall[]>;
  loadingLead: string | null;
  error: string | null;
  fetch: (leadId: string) => Promise<void>;
  add: (leadId: string, input: FollowUpCallCreateInput) => Promise<void>;
  update: (leadId: string, callId: string, patch: FollowUpCallPatch) => Promise<void>;
}

export const useFollowUpCallsStore = create<FollowUpCallsState>((set) => ({
  byLead: {},
  loadingLead: null,
  error: null,

  fetch: async (leadId) => {
    set({ loadingLead: leadId, error: null });
    try {
      const calls = await followUpCallsApi.list(leadId);
      set((s) => ({ byLead: { ...s.byLead, [leadId]: calls }, loadingLead: null }));
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load follow-up calls",
        loadingLead: null,
      });
    }
  },

  add: async (leadId, input) => {
    const created = await followUpCallsApi.create(leadId, input);
    set((s) => ({
      byLead: { ...s.byLead, [leadId]: [created, ...(s.byLead[leadId] ?? [])] },
    }));
  },

  update: async (leadId, callId, patch) => {
    const updated = await followUpCallsApi.update(leadId, callId, patch);
    set((s) => ({
      byLead: {
        ...s.byLead,
        [leadId]: (s.byLead[leadId] ?? []).map((c) => (c.id === callId ? updated : c)),
      },
    }));
  },
}));
