// Intake notes store — API-backed, keyed by lead id. Backs the client profile's
// "Intake Notes" card (services/intakeNotes.ts).

import { create } from "zustand";
import type { ProfileNote } from "@/types/crm";
import { intakeNotesApi } from "@/services/intakeNotes";

interface IntakeNotesState {
  byLead: Record<string, ProfileNote[]>;
  loadingLead: string | null;
  error: string | null;
  fetch: (leadId: string) => Promise<void>;
  add: (leadId: string, text: string) => Promise<void>;
  update: (leadId: string, noteId: string, text: string) => Promise<void>;
  remove: (leadId: string, noteId: string) => Promise<void>;
}

export const useIntakeNotesStore = create<IntakeNotesState>((set) => ({
  byLead: {},
  loadingLead: null,
  error: null,

  fetch: async (leadId) => {
    set({ loadingLead: leadId, error: null });
    try {
      const notes = await intakeNotesApi.list(leadId);
      set((s) => ({ byLead: { ...s.byLead, [leadId]: notes }, loadingLead: null }));
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load intake notes",
        loadingLead: null,
      });
    }
  },

  add: async (leadId, text) => {
    const created = await intakeNotesApi.create(leadId, text);
    set((s) => ({
      byLead: { ...s.byLead, [leadId]: [created, ...(s.byLead[leadId] ?? [])] },
    }));
  },

  update: async (leadId, noteId, text) => {
    const updated = await intakeNotesApi.update(leadId, noteId, text);
    set((s) => ({
      byLead: {
        ...s.byLead,
        [leadId]: (s.byLead[leadId] ?? []).map((n) => (n.id === noteId ? updated : n)),
      },
    }));
  },

  remove: async (leadId, noteId) => {
    await intakeNotesApi.remove(leadId, noteId);
    set((s) => ({
      byLead: {
        ...s.byLead,
        [leadId]: (s.byLead[leadId] ?? []).filter((n) => n.id !== noteId),
      },
    }));
  },
}));
