// Core CRM domain types — used across calculator, pipeline, profile, and documents.

export type TaxYear = 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026;
export const ALL_TAX_YEARS: TaxYear[] = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

export type FilingStatus = "single" | "mfj" | "280c";

export interface FilingStatusOption {
  value: FilingStatus;
  label: string;
  rate: number;
}

export const FILING_STATUSES: FilingStatusOption[] = [
  { value: "single", label: "Single", rate: 0.21 },
  { value: "mfj", label: "Married Filing Jointly", rate: 0.35 },
  { value: "280c", label: "280C", rate: 0.21 },
];

export interface ClientInfo {
  clientName: string;
  /** Multi-select tax years (years the client wants R&D credits for). */
  taxYears: TaxYear[];
  filingStatus: FilingStatus;
}

export interface Entity {
  id: string;
  companyName: string;
  state: string;
  employeeCount: number | "";
  estimatedQRAs: number | "";
  grossCredit: number | "";
  w2Wages: number | "";
  contractResearch: number | "";
  supplies: number | "";
  otherQualified: number | "";
  notes: string;
}

// Leads / Pipeline
export type LeadStatus = "new" | "calculation_sent" | "sow_signed" | "active_engagement" | "lost";

export type LeadSource =
  | "Referral"
  | "Website"
  | "Cold Call"
  | "Conference"
  | "LinkedIn"
  | "Partner"
  | "Other";

// Sales rep names now come from the API (GET /users/), so `rep` is a free
// string (a user's full name) rather than a fixed union.
export type SalesRep = string;

/** Whether this is a brand-new client or a returning one (GET /leads.client_type). */
export type ClientType = "New" | "Returning";

export interface Lead {
  id: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  rep: SalesRep;
  /** Backend user id of the assigned salesperson, if any. */
  repId?: number | null;
  status: LeadStatus;
  clientType?: ClientType;
  /** Legacy: count of years engaged (kept for backwards compat). */
  engagementYears: number;
  /** Tax years selected for this client's engagement. */
  taxYears: TaxYear[];
  engagedSince: string;
  /** ISO date (YYYY-MM-DD) the SOW was signed, if any. */
  sowSignedAt?: string;
  entitiesCount: number;
  entityNames?: string[];
  latestCalculation: string;
  addedAt: string;
  notes?: string;
  intakeNotes?: ProfileNote[];
  intake?: IntakeAnswers;
}

export interface ProfileNote {
  id: string;
  text: string;
  createdAt: string;
  author?: string;
}

export interface IntakeAnswers {
  multiState: boolean;
  priorRdCredits: boolean;
  governmentGrants: boolean;
  qualifiedResearchExpenses: boolean;
}

// Engagement / Profile
export type EngagementType = "R&D Tax Credit" | "Cost Segregation" | "ERC" | "Other";
export type EngagementStatus = "Draft" | "Active" | "Completed" | "On Hold";
export type EngagementPhase = "Intake" | "Calculation" | "Review" | "Filed";

export interface YearBilling {
  year: TaxYear;
  amount: number;
}

export interface Engagement {
  id: string;
  clientId: string;
  type: EngagementType;
  status: EngagementStatus;
  phase: EngagementPhase;
  years: TaxYear[];
  billing: YearBilling[];
  createdAt: string;
}

export interface ContactPerson {
  id: string;
  clientId: string;
  firstName: string;
  lastName: string;
  role: string;
  workEmail: string;
  email: string;
  workPhone: string;
  mobilePhone: string;
}

export interface ClientEntity {
  id: string;
  clientId: string;
  name: string;
  ein: string;
  contacts: { name: string; role: string }[];
}

export interface FollowUpCall {
  id: string;
  clientId: string;
  date: string;
  time: string;
  notes: string;
  completed?: boolean;
}

// Documents
export type DocumentStatus = "received" | "pending" | "overdue";

export const DOCUMENT_TYPES = [
  "Federal Business Return",
  "Form 1040",
  "General Ledger",
  "P&L Statement",
  "W-2 / QRE Wages",
  "Payroll Details",
  "State Returns",
  "Trial Balance",
  "Operating Agreement",
  "Balance Sheet",
  "Contract Research Docs",
  "Timesheets",
  "Articles of Organization",
] as const;

export type DocumentType = string;

export interface DocumentRequest {
  id: string;
  engagementId: string;
  clientId: string;
  clientName: string;
  recipientName: string;
  recipientEmail: string;
  taxYears: TaxYear[];
  sentDate: string;
  dueDate: string;
  items: { type: string; received: boolean }[];
  /** Optional override for the document count badge (e.g. when one type represents multiple files). */
  totalOverride?: number;
}
