// Calculator store — manages client info, multi-year tax selection, and dynamic entity cards.

import { create } from "zustand";
import type { ClientInfo, Entity, FilingStatus, TaxYear } from "@/types/crm";
import { ALL_TAX_YEARS } from "@/types/crm";

const newEntity = (i: number): Entity => ({
  id: `ent_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
  companyName: "",
  state: "",
  employeeCount: "",
  estimatedQRAs: "",
  grossCredit: "",
  w2Wages: "",
  contractResearch: "",
  supplies: "",
  otherQualified: "",
  notes: "",
});

interface CalculatorState {
  client: ClientInfo;
  entityCountInput: number;
  entities: Entity[];
  notes: string;
  setClientField: <K extends keyof ClientInfo>(k: K, v: ClientInfo[K]) => void;
  toggleTaxYear: (y: TaxYear) => void;
  selectAllTaxYears: () => void;
  clearTaxYears: () => void;
  setEntityCountInput: (n: number) => void;
  generateEntities: (n: number) => void;
  addEntity: () => void;
  removeEntity: (id: string) => void;
  updateEntity: <K extends keyof Entity>(id: string, k: K, v: Entity[K]) => void;
  setNotes: (s: string) => void;
  hydrateFromLead: (clientName: string, taxYears: TaxYear[]) => void;
}

export const useCalculatorStore = create<CalculatorState>((set) => ({
  client: {
    clientName: "",
    taxYears: [2025 as TaxYear],
    filingStatus: "mfj" as FilingStatus,
  },
  entityCountInput: 1,
  entities: [],
  notes: "",
  setClientField: (k, v) => set((s) => ({ client: { ...s.client, [k]: v } })),
  toggleTaxYear: (y) =>
    set((s) => {
      const has = s.client.taxYears.includes(y);
      const next = has ? s.client.taxYears.filter((x) => x !== y) : [...s.client.taxYears, y];
      next.sort((a, b) => a - b);
      return { client: { ...s.client, taxYears: next } };
    }),
  selectAllTaxYears: () => set((s) => ({ client: { ...s.client, taxYears: [...ALL_TAX_YEARS] } })),
  clearTaxYears: () => set((s) => ({ client: { ...s.client, taxYears: [] } })),
  setEntityCountInput: (n) => set({ entityCountInput: Math.max(1, Math.min(50, n)) }),
  generateEntities: (n) =>
    set(() => ({ entities: Array.from({ length: n }, (_, i) => newEntity(i)) })),
  addEntity: () => set((s) => ({ entities: [...s.entities, newEntity(s.entities.length)] })),
  removeEntity: (id) => set((s) => ({ entities: s.entities.filter((e) => e.id !== id) })),
  updateEntity: (id, k, v) =>
    set((s) => ({ entities: s.entities.map((e) => (e.id === id ? { ...e, [k]: v } : e)) })),
  setNotes: (s) => set({ notes: s }),
  hydrateFromLead: (clientName, taxYears) =>
    set((s) => ({ client: { ...s.client, clientName, taxYears: taxYears.length ? taxYears : s.client.taxYears } })),
}));
