// Document request configuration store — holds in-progress configuration
// shared between Configure and Review pages.

import { create } from "zustand";

export interface DocCategoryDef {
  id: string;
  title: string;
  items: string[];
}

export const DOC_CATEGORIES: DocCategoryDef[] = [
  {
    id: "tax_returns",
    title: "Tax Returns",
    items: [
      "Federal Business Tax Return (Form 1120 / 1120-S / 1065)",
      "Federal Individual Tax Return (Form 1040)",
      "State Tax Return(s)",
      "Payroll Tax Returns (Form 941)",
      "Prior Year Tax Returns (All Entities)",
    ],
  },
  {
    id: "financial",
    title: "Financial Records",
    items: [
      "General Ledger (GL) — Full Detail",
      "Profit & Loss Statement",
      "Balance Sheet",
      "Trial Balance",
      "Chart of Accounts",
    ],
  },
  {
    id: "rd_docs",
    title: "R&D Documentation",
    items: [
      "W-2 Wages for Qualified Research Employees",
      "Contract Research Agreements",
      "Supply & Lab Expense Records",
      "Time Tracking / Timesheets",
      "Project Notes / Lab Notebooks",
    ],
  },
  {
    id: "corporate",
    title: "Corporate & Entity Docs",
    items: [
      "Articles of Incorporation / Organization",
      "Operating Agreement / Bylaws",
      "Ownership / Shareholder Agreement",
      "EIN / IRS Assignment Letters",
    ],
  },
  {
    id: "payroll",
    title: "Payroll & HR",
    items: [
      "Payroll Detail Reports by Employee",
      "W-2 / W-3 Summary",
      "1099-NEC / Contractor Payments",
      "Benefits & Compensation Summaries",
    ],
  },
];

interface DocConfigState {
  /** key: engagementId → selected document strings */
  selectionsByEngagement: Record<string, string[]>;
  /** key: engagementId → selected contact ids */
  contactsByEngagement: Record<string, string[]>;
  /** key: engagementId → due date */
  dueDateByEngagement: Record<string, string>;
  /** key: engagementId → notes */
  notesByEngagement: Record<string, string>;
  setSelections: (engId: string, items: string[]) => void;
  seedIfEmpty: (engId: string, items: string[]) => void;
  toggleItem: (engId: string, item: string) => void;
  setCategoryAll: (engId: string, categoryId: string, on: boolean) => void;
  toggleContact: (engId: string, contactId: string) => void;
  setDueDate: (engId: string, d: string) => void;
  setNotes: (engId: string, n: string) => void;
  reset: (engId: string) => void;
}

export const useDocConfigStore = create<DocConfigState>((set) => ({
  selectionsByEngagement: {},
  contactsByEngagement: {},
  dueDateByEngagement: {},
  notesByEngagement: {},
  setSelections: (engId, items) =>
    set((s) => ({ selectionsByEngagement: { ...s.selectionsByEngagement, [engId]: items } })),
  seedIfEmpty: (engId, items) =>
    set((s) =>
      engId in s.selectionsByEngagement
        ? s
        : { selectionsByEngagement: { ...s.selectionsByEngagement, [engId]: items } },
    ),
  toggleItem: (engId, item) =>
    set((s) => {
      const cur = s.selectionsByEngagement[engId] ?? [];
      const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
      return { selectionsByEngagement: { ...s.selectionsByEngagement, [engId]: next } };
    }),
  setCategoryAll: (engId, categoryId, on) =>
    set((s) => {
      const cat = DOC_CATEGORIES.find((c) => c.id === categoryId);
      if (!cat) return s;
      const cur = s.selectionsByEngagement[engId] ?? [];
      const without = cur.filter((x) => !cat.items.includes(x));
      const next = on ? [...without, ...cat.items] : without;
      return { selectionsByEngagement: { ...s.selectionsByEngagement, [engId]: next } };
    }),
  toggleContact: (engId, contactId) =>
    set((s) => {
      const cur = s.contactsByEngagement[engId] ?? [];
      const next = cur.includes(contactId) ? cur.filter((x) => x !== contactId) : [...cur, contactId];
      return { contactsByEngagement: { ...s.contactsByEngagement, [engId]: next } };
    }),
  setDueDate: (engId, d) =>
    set((s) => ({ dueDateByEngagement: { ...s.dueDateByEngagement, [engId]: d } })),
  setNotes: (engId, n) =>
    set((s) => ({ notesByEngagement: { ...s.notesByEngagement, [engId]: n } })),
  reset: (engId) =>
    set((s) => {
      const sel = { ...s.selectionsByEngagement }; delete sel[engId];
      const con = { ...s.contactsByEngagement }; delete con[engId];
      const dd = { ...s.dueDateByEngagement }; delete dd[engId];
      const nt = { ...s.notesByEngagement }; delete nt[engId];
      return { selectionsByEngagement: sel, contactsByEngagement: con, dueDateByEngagement: dd, notesByEngagement: nt };
    }),
}));

// Existing contacts shared across all engagements.
export interface DocContact { id: string; name: string; role: string; email: string }

interface ContactsState {
  contacts: DocContact[];
  addContact: (c: Omit<DocContact, "id">) => DocContact;
}

const seedContacts: DocContact[] = [
  { id: "dc1", name: "Dr. Harpreet Gill", role: "Owner / Physician", email: "hgill@northshoresurgical.com" },
  { id: "dc2", name: "Amanda Torres", role: "Office Manager", email: "atorres@northshoresurgical.com" },
  { id: "dc3", name: "David Kim, CPA", role: "External Accountant", email: "dkim@brightlinecpa.com" },
];

export const useDocContactsStore = create<ContactsState>((set, get) => ({
  contacts: seedContacts,
  addContact: (c) => {
    const created = { ...c, id: `dc_${Date.now()}` };
    set((s) => ({ contacts: [...s.contacts, created] }));
    return created;
  },
}));
