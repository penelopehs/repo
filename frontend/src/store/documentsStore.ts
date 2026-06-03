// Document Requests store + seed data.

import { create } from "zustand";
import type { DocumentRequest } from "@/types/crm";

// Seed requests use names from DOC_CATEGORIES so the Overview's
// "View document types" list and the Edit Request checkboxes always
// reference the same document strings.
const seed: DocumentRequest[] = [
  {
    id: "REQ-2026-001",
    engagementId: "ENG-2026-001",
    clientId: "ld_001",
    clientName: "Nimbus Robotics, Inc.",
    recipientName: "Robert Chen",
    recipientEmail: "r.chen@nimbusrobotics.com",
    taxYears: [2023, 2024, 2025],
    sentDate: "2026-05-01",
    dueDate: "2026-06-14",
    items: [
      { type: "State Tax Return(s)", received: true },
      { type: "Balance Sheet", received: false },
      { type: "W-2 / W-3 Summary", received: true },
    ],
  },
  {
    id: "REQ-2026-002",
    engagementId: "ENG-2026-002",
    clientId: "ld_005",
    clientName: "Vertex BioSolutions LLC",
    recipientName: "Marcus Hill",
    recipientEmail: "m.hill@vertexbio.com",
    taxYears: [2024, 2025, 2026],
    sentDate: "2026-04-20",
    dueDate: "2026-06-20",
    items: [
      { type: "Federal Business Tax Return (Form 1120 / 1120-S / 1065)", received: true },
      { type: "Payroll Detail Reports by Employee", received: true },
      { type: "General Ledger (GL) — Full Detail", received: false },
      { type: "W-2 Wages for Qualified Research Employees", received: false },
      { type: "W-2 / W-3 Summary", received: true },
    ],
  },
  {
    id: "REQ-2026-003",
    engagementId: "ENG-2026-003",
    clientId: "ld_002",
    clientName: "Atlas Quantum Systems",
    recipientName: "Priya Shankar",
    recipientEmail: "priya@atlasquantum.com",
    taxYears: [2024, 2025],
    sentDate: "2026-04-10",
    dueDate: "2026-05-18",
    items: [
      { type: "State Tax Return(s)", received: true },
      { type: "Fixed Asset Schedule", received: false },
      { type: "Trial Balance", received: false },
      { type: "W-2 / W-3 Summary", received: true },
    ],
  },
  // ── Completed requests ──
  {
    id: "REQ-2026-004",
    engagementId: "ENG-2026-004",
    clientId: "ld_003",
    clientName: "Helix Data Systems LLC",
    recipientName: "Daniel Ortiz",
    recipientEmail: "d.ortiz@helixdata.com",
    taxYears: [2023, 2024, 2025],
    sentDate: "2026-03-15",
    dueDate: "2026-04-15",
    totalOverride: 12,
    items: [
      { type: "Federal Tax Return", received: true },
      { type: "Bank Statements", received: true },
      { type: "Payroll Summary", received: true },
      { type: "W-2 / W-3 Summary", received: true },
    ],
  },
  {
    id: "REQ-2026-005",
    engagementId: "ENG-2026-005",
    clientId: "ld_004",
    clientName: "Orion Manufacturing Group",
    recipientName: "Sarah Kim",
    recipientEmail: "s.kim@orionmfg.com",
    taxYears: [2024, 2025],
    sentDate: "2026-02-20",
    dueDate: "2026-03-20",
    totalOverride: 9,
    items: [
      { type: "State Tax Return(s)", received: true },
      { type: "General Ledger", received: true },
      { type: "Expense Reports", received: true },
    ],
  },
  {
    id: "REQ-2026-006",
    engagementId: "ENG-2026-006",
    clientId: "ld_006",
    clientName: "Aurora Cloud Technologies",
    recipientName: "James Patel",
    recipientEmail: "j.patel@auroracloud.io",
    taxYears: [2023, 2024, 2025, 2026],
    sentDate: "2026-01-10",
    dueDate: "2026-02-10",
    totalOverride: 15,
    items: [
      { type: "Tax Returns", received: true },
      { type: "Financial Statements", received: true },
      { type: "Revenue Reports", received: true },
      { type: "Contracts", received: true },
      { type: "Compliance Docs", received: true },
      { type: "W-2 / W-3 Summary", received: true },
    ],
  },
];

interface DocsState {
  requests: DocumentRequest[];
  addRequest: (r: Omit<DocumentRequest, "id" | "items"> & { itemCount?: number }) => void;
}

export const useDocumentsStore = create<DocsState>((set) => ({
  requests: seed,
  addRequest: (r) =>
    set((s) => ({
      requests: [...s.requests, { ...r, id: `REQ-${Date.now()}`, items: [] }],
    })),
}));

export const requestStatus = (r: DocumentRequest): "received" | "pending" | "overdue" => {
  const total = r.items.length;
  const received = r.items.filter((i) => i.received).length;
  if (total > 0 && received === total) return "received";
  if (new Date(r.dueDate).getTime() < Date.now()) return "overdue";
  return "pending";
};

export const requestProgress = (r: DocumentRequest) => ({
  received: r.items.filter((i) => i.received).length,
  total: r.items.length,
});
