// Leads store — API-backed pipeline data with reactive KPIs and full mutators.
//
// State is the single source of truth the Client Dashboard reads from; mutators
// call the FastAPI backend (services/leads.ts) and reconcile local state with the
// server response so KPIs/tables stay in sync. Read-only consumers (ProfilePage,
// ConfigureRequestPage) keep using the same `leads` selector unchanged.

import { create } from "zustand";
import type { Lead, LeadStatus } from "@/types/crm";
import { leadsApi, type LeadCreateInput } from "@/services/leads";

interface LeadsState {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  fetchLeads: () => Promise<void>;
  addLead: (l: LeadCreateInput) => Promise<void>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  setStatus: (id: string, status: LeadStatus) => Promise<void>;
  promoteToActive: (id: string) => Promise<void>;
  getLead: (id: string) => Lead | undefined;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  loading: false,
  error: null,

  fetchLeads: async () => {
    set({ loading: true, error: null });
    try {
      const leads = await leadsApi.list();
      set({ leads, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load leads",
        loading: false,
      });
    }
  },

  addLead: async (l) => {
    const created = await leadsApi.create(l);
    set((s) => ({ leads: [created, ...s.leads] }));
  },

  updateLead: async (id, patch) => {
    const updated = await leadsApi.update(id, patch);
    set((s) => ({ leads: s.leads.map((x) => (x.id === id ? updated : x)) }));
  },

  deleteLead: async (id) => {
    await leadsApi.remove(id);
    set((s) => ({ leads: s.leads.filter((x) => x.id !== id) }));
  },

  setStatus: async (id, status) => {
    const updated = await leadsApi.update(id, { status });
    set((s) => ({ leads: s.leads.map((x) => (x.id === id ? updated : x)) }));
  },

  promoteToActive: async (id) => {
    const updated = await leadsApi.update(id, { status: "active_engagement" });
    set((s) => ({ leads: s.leads.map((x) => (x.id === id ? updated : x)) }));
  },

  getLead: (id) => get().leads.find((l) => l.id === id),
}));
