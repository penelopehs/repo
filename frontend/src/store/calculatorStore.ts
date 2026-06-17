// Calculator store — manages client info, multi-year tax selection, and dynamic entity cards.

import { create } from "zustand";
import type {
  ClientInfo,
  Entity,
  EntityOwner,
  FilingStatus,
  Lead,
  LeadData,
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

// Reverse of entityFromLead: project a calculator card back onto a master entity
// (id-less). Only the fields a card carries are mapped; the rest (ein, city, …)
// stay with the existing master entity during the merge below.
const leadEntityFromCard = (card: Omit<Entity, "id">): Omit<LeadDataEntity, "id"> => ({
  name: card.companyName ?? "",
  state: card.state ?? "",
  employeeCount: card.employeeCount ?? "",
  w2Wages: card.wagesW2 ?? "",
  contractResearch: card.contractWages ?? "",
  supplies: card.totalSupplies ?? "",
  notes: card.notes ?? "",
});

// Entity identity for de-duplication: the name, trimmed and lower-cased.
const normalizeEntityName = (name: string | undefined): string => (name ?? "").trim().toLowerCase();

const isEmptyValue = (v: unknown): boolean => v === "" || v === null || v === undefined;

// A url-safe slug mirroring services/leads.ts:entitySlug, used to mint a stable
// id for an entity that exists only in a year's calculation (never seeded into
// the master list).
const entityNameSlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "entity";

// Rebuild the master entity list (data.entities) from every year's saved
// calculation. The result is the set of unique entities (by normalized name)
// present across all years; the original snapshot (initialEntities) is folded in
// only when at least one year is empty, so an entity that was seeded but never
// calculated isn't lost. Existing master/initial entities are matched by name and
// kept intact (id, entityId, ein, city, …) with the calculator card's edits
// overlaid; entities that appear only in a calculation get a fresh stable id.
export const recalcMasterEntities = (
  data: LeadData,
): Pick<LeadData, "entities" | "initialEntities"> => {
  const initialEntities = data.initialEntities ?? data.entities ?? [];
  const calculations = data.calculations ?? {};
  const years = Object.keys(calculations)
    .map(Number)
    .filter((y): y is TaxYear => ALL_TAX_YEARS.includes(y as TaxYear))
    .sort((a, b) => a - b);

  // Look up rich, id-bearing entities by name to preserve them across the
  // rebuild. data.entities (the current master) takes precedence over the older
  // initialEntities snapshot when both hold the same name.
  const existingByName = new Map<string, LeadDataEntity>();
  for (const e of [...initialEntities, ...(data.entities ?? [])]) {
    const key = normalizeEntityName(e.name);
    if (key) existingByName.set(key, e);
  }

  // Candidate stream in priority order: every year's cards, then the initial
  // snapshot (only if some year is empty).
  const candidates: Array<Omit<LeadDataEntity, "id">> = [];
  let anyEmpty = false;
  for (const year of years) {
    const calc = calculations[String(year)];
    if (Array.isArray(calc) && calc.length > 0) {
      for (const card of calc as Array<Omit<Entity, "id">>)
        candidates.push(leadEntityFromCard(card));
    } else {
      anyEmpty = true;
    }
  }
  if (anyEmpty) {
    for (const e of initialEntities) {
      const { id: _id, ...rest } = e;
      candidates.push(rest);
    }
  }

  const usedIds = new Set<string>(
    [...initialEntities, ...(data.entities ?? [])].map((e) => e.id).filter(Boolean),
  );
  const mintId = (name: string): string => {
    const base = `e_${entityNameSlug(name)}`;
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}_${n}`;
    return id;
  };

  const seen = new Set<string>();
  const entities: LeadDataEntity[] = [];
  for (const cand of candidates) {
    const key = normalizeEntityName(cand.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const base = existingByName.get(key);
    if (base) {
      // Keep the rich master entity; overlay only the card's non-empty fields so
      // a blank card never erases data the master already holds.
      const merged = { ...base } as Record<string, unknown>;
      for (const [k, v] of Object.entries(cand)) {
        if (!isEmptyValue(v)) merged[k] = v;
      }
      entities.push(merged as unknown as LeadDataEntity);
    } else {
      const id = mintId(cand.name);
      usedIds.add(id);
      entities.push({ ...cand, id });
    }
  }

  return { entities, initialEntities };
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
    set((s) => ({
      entities: [
        ...s.entities,
        ...Array.from({ length: n }, (_, i) => newEntity(s.entities.length + i)),
      ],
    })),
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
