// Calculator store — manages client info, multi-year tax selection, and dynamic entity cards.

import { create } from "zustand";
import type {
  ClientInfo,
  Entity,
  EntityOwner,
  FilingStatus,
  Lead,
  LeadDataEntity,
  TaxYear,
} from "@/types/crm";
import { ALL_TAX_YEARS } from "@/types/crm";

const newOwner = (): EntityOwner => ({
  id: `own_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  firstName: "",
  lastName: "",
  role: "",
  ownershipPct: "",
});

const newEntity = (i: number): Entity => ({
  id: `ent_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
  companyName: "",
  state: "",
  employeeCount: "",
  filingStatus: "",
  grossRevenue: "",
  wagesOfficers: "",
  wagesW2: "",
  contractWages: "",
  totalSupplies: "",
  notes: "",
  owners: [],
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
  addOwner: (entityId: string) => void;
  removeOwner: (entityId: string, ownerId: string) => void;
  updateOwner: <K extends keyof EntityOwner>(
    entityId: string,
    ownerId: string,
    k: K,
    v: EntityOwner[K],
  ) => void;
  setNotes: (s: string) => void;
  hydrateFromLead: (clientName: string, taxYears: TaxYear[]) => void;
  loadLeadEntities: (leadEntities: LeadDataEntity[]) => void;
  setEntities: (entities: Entity[]) => void;
}

// Map a lead's stored entity (data.entities[]) onto a calculator entity card.
// Only fields with a direct counterpart are carried over; the rest keep their
// empty defaults for the user to fill in. Pure mapping — no calculation logic.
const entityFromLead = (le: LeadDataEntity, i: number): Entity => ({
  ...newEntity(i),
  companyName: le.name ?? "",
  state: le.state ?? "",
  employeeCount: le.employeeCount ?? "",
  wagesW2: le.w2Wages ?? "",
  contractWages: le.contractResearch ?? "",
  totalSupplies: le.supplies ?? "",
  notes: le.notes ?? "",
});

// Build calculator entity cards from a lead's master entity list. Exported so
// callers can hold the resulting array reference (e.g. to tell a freshly seeded
// preview apart from a user edit).
export const entitiesFromLead = (leadEntities: LeadDataEntity[]): Entity[] =>
  leadEntities.map(entityFromLead);

// The entity id belongs to the master list (lead.data.entities) and is not
// duplicated inside a year's saved calculation. Strip it before persisting.
export const stripEntityIds = (entities: Entity[]): Array<Omit<Entity, "id">> =>
  entities.map((e) => {
    const copy: Partial<Entity> = { ...e };
    delete copy.id;
    return copy as Omit<Entity, "id">;
  });

// Rebuild calculator entity cards from a year's saved (id-less) calculation,
// assigning a fresh card id (ids aren't stored inside calculations).
export const entitiesFromSaved = (saved: Array<Omit<Entity, "id">>): Entity[] =>
  saved.map((e, i) => ({ ...e, id: newEntity(i).id }));

// Resolve the entity cards for a given tax year: a year's own saved calculation
// when present, otherwise a seed from the lead's master entity list. Shared by
// the calculator's per-year hydration and the multi-year PDF export.
export const entitiesForYear = (lead: Pick<Lead, "data">, year: TaxYear): Entity[] => {
  const saved = lead.data?.calculations?.[String(year)];
  return Array.isArray(saved) && saved.length > 0
    ? entitiesFromSaved(saved as Array<Omit<Entity, "id">>)
    : entitiesFromLead(lead.data?.entities ?? []);
};

export const useCalculatorStore = create<CalculatorState>((set) => ({
  client: {
    clientName: "",
    taxYears: [],
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
  addOwner: (entityId) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === entityId ? { ...e, owners: [...e.owners, newOwner()] } : e,
      ),
    })),
  removeOwner: (entityId, ownerId) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === entityId ? { ...e, owners: e.owners.filter((o) => o.id !== ownerId) } : e,
      ),
    })),
  updateOwner: (entityId, ownerId, k, v) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === entityId
          ? {
              ...e,
              owners: e.owners.map((o) => (o.id === ownerId ? { ...o, [k]: v } : o)),
            }
          : e,
      ),
    })),
  setNotes: (s) => set({ notes: s }),
  hydrateFromLead: (clientName, taxYears) =>
    set((s) => ({
      client: { ...s.client, clientName, taxYears: taxYears.length ? taxYears : s.client.taxYears },
    })),
  loadLeadEntities: (leadEntities) =>
    set(() => {
      const entities = leadEntities.map(entityFromLead);
      return { entities };
    }),
  setEntities: (entities) => set({ entities }),
}));
