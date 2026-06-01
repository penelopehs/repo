// Engagements, contacts, client entities, follow-up calls.

import { create } from "zustand";
import type {
  Engagement,
  EngagementType,
  EngagementStatus,
  EngagementPhase,
  ContactPerson,
  ClientEntity,
  FollowUpCall,
  TaxYear,
  YearBilling,
} from "@/types/crm";

const seedEngagements: Engagement[] = [
  {
    id: "eng_001",
    clientId: "ld_001",
    type: "R&D Tax Credit",
    status: "Active",
    phase: "Calculation",
    years: [2023, 2024, 2025],
    billing: [
      { year: 2023, amount: 8000 },
      { year: 2024, amount: 9500 },
      { year: 2025, amount: 10000 },
    ],
    createdAt: "2024-01-15",
  },
  {
    id: "eng_002",
    clientId: "ld_005",
    type: "R&D Tax Credit",
    status: "Active",
    phase: "Review",
    years: [2024, 2025, 2026],
    billing: [
      { year: 2024, amount: 7500 },
      { year: 2025, amount: 9000 },
      { year: 2026, amount: 6000 },
    ],
    createdAt: "2024-03-02",
  },
];

const seedContacts: ContactPerson[] = [
  { id: "c1", clientId: "ld_001", name: "Robert Chen", role: "Point of Contact", email: "r.chen@nimbusrobotics.com", phone: "(415) 555-1009" },
  { id: "c2", clientId: "ld_001", name: "Sandra Wu", role: "CPA", email: "s.wu@nimbusrobotics.com", phone: "(415) 555-2210" },
  { id: "c3", clientId: "ld_005", name: "Marcus Hill", role: "Point of Contact", email: "m.hill@northbeam.com", phone: "(404) 555-7700" },
];

const seedEntities: ClientEntity[] = [
  { id: "ce1", clientId: "ld_001", name: "Nimbus Robotics, Inc.", ein: "84-2910442", contacts: [{ name: "Robert Chen", role: "Point of Contact" }, { name: "Sandra Wu", role: "CPA" }] },
  { id: "ce2", clientId: "ld_001", name: "Nimbus Software, LLC", ein: "84-2910443", contacts: [{ name: "Robert Chen", role: "Point of Contact" }] },
  { id: "ce3", clientId: "ld_005", name: "Northbeam Industries", ein: "58-3300112", contacts: [{ name: "Marcus Hill", role: "Point of Contact" }] },
];

const seedCalls: FollowUpCall[] = [
  { id: "fc1", clientId: "ld_001", date: "2025-12-08", time: "10:00", notes: "Quarterly check-in" },
];

interface EngagementsState {
  engagements: Engagement[];
  contacts: ContactPerson[];
  entities: ClientEntity[];
  calls: FollowUpCall[];
  addEngagement: (e: { clientId: string; type: EngagementType; status: EngagementStatus; phase: EngagementPhase; years: TaxYear[]; billing: YearBilling[] }) => void;
  addCall: (c: Omit<FollowUpCall, "id">) => void;
  byClient: (clientId: string) => {
    engagements: Engagement[];
    contacts: ContactPerson[];
    entities: ClientEntity[];
    calls: FollowUpCall[];
  };
}

export const useEngagementsStore = create<EngagementsState>((set, get) => ({
  engagements: seedEngagements,
  contacts: seedContacts,
  entities: seedEntities,
  calls: seedCalls,
  addEngagement: (e) =>
    set((s) => ({
      engagements: [
        ...s.engagements,
        { ...e, id: `eng_${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) },
      ],
    })),
  addCall: (c) => set((s) => ({ calls: [...s.calls, { ...c, id: `fc_${Date.now()}` }] })),
  byClient: (clientId) => {
    const s = get();
    return {
      engagements: s.engagements.filter((e) => e.clientId === clientId),
      contacts: s.contacts.filter((c) => c.clientId === clientId),
      entities: s.entities.filter((e) => e.clientId === clientId),
      calls: s.calls.filter((c) => c.clientId === clientId),
    };
  },
}));
