// Leads store — pipeline data with reactive KPIs and full mutators.

import { create } from "zustand";
import type { Lead, LeadStatus, TaxYear } from "@/types/crm";
import { MOCK_LEADS } from "@/data/mockLeads";

interface LeadsState {
  leads: Lead[];
  addLead: (
    l: Omit<
      Lead,
      | "id"
      | "addedAt"
      | "status"
      | "engagementYears"
      | "engagedSince"
      | "entitiesCount"
      | "latestCalculation"
      | "taxYears"
    > & { taxYears?: TaxYear[] },
  ) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  setStatus: (id: string, status: LeadStatus) => void;
  promoteToActive: (id: string) => void;
  getLead: (id: string) => Lead | undefined;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: MOCK_LEADS,
  addLead: (l) =>
    set((s) => ({
      leads: [
        {
          ...l,
          taxYears: l.taxYears ?? [],
          id: `ld_${Date.now()}`,
          status: "new",
          engagementYears: 0,
          engagedSince: "",
          entitiesCount: 0,
          latestCalculation: "—",
          addedAt: new Date().toISOString(),
        } as Lead,
        ...s.leads,
      ],
    })),
  updateLead: (id, patch) =>
    set((s) => ({ leads: s.leads.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  deleteLead: (id) => set((s) => ({ leads: s.leads.filter((x) => x.id !== id) })),
  setStatus: (id, status) =>
    set((s) => ({ leads: s.leads.map((x) => (x.id === id ? { ...x, status } : x)) })),
  promoteToActive: (id) =>
    set((s) => ({
      leads: s.leads.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "active_engagement",
              engagedSince: x.engagedSince || new Date().toISOString().slice(0, 10),
              engagementYears: Math.max(1, x.engagementYears),
            }
          : x,
      ),
    })),
  getLead: (id) => get().leads.find((l) => l.id === id),
}));
