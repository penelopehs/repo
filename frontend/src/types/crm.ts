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

export interface EntityOwner {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  ownershipPct: number | "";
}

export interface Entity {
  id: string;
  companyName: string;
  state: string;
  employeeCount: number | "";
  filingStatus: string;
  customFilingStatus?: string;
  grossRevenue: number | "";
  wagesOfficers: number | "";
  wagesW2: number | "";
  contractWages: number | "";
  totalSupplies: number | "";
  notes: string;
  owners: EntityOwner[];
}

// Leads / Pipeline
//
// Pipeline stages mirror the backend `PipelineStatus` enum (models.py). They are
// ordered: a lead advances New Lead → Intro Call → Feasibility Call → Tax
// Preparer Coordination → Closed. The numeric index of `status` in
// PIPELINE_STAGES is the lead's progress through the pipeline.
export type LeadStatus =
  | "new_lead"
  | "intro_call"
  | "feasibility_call"
  | "tax_preparer_coordination"
  | "closed";

/** Ordered pipeline stages with display labels (index = pipeline progress). */
export const PIPELINE_STAGES: { value: LeadStatus; label: string }[] = [
  { value: "new_lead", label: "New Lead" },
  { value: "intro_call", label: "Intro Call" },
  { value: "feasibility_call", label: "Feasibility Call" },
  { value: "tax_preparer_coordination", label: "Tax Preparer Coordination" },
  { value: "closed", label: "Closed" },
];

/** Progress index of a status within the pipeline (0 = New Lead). */
export const pipelineStageIndex = (status: LeadStatus): number =>
  Math.max(0, PIPELINE_STAGES.findIndex((s) => s.value === status));

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

export interface LeadDataEntity {
  /** Stable per-lead id used to link people to this entity (see
   *  LeadData.entityPeople). Assigned by the frontend on load/save. */
  id: string;
  /** Source entity id (entities.entity_id) when seeded from the client graph. */
  entityId?: number;
  name: string;
  ein?: string;
  city?: string;
  state?: string;
  employeeCount?: number | "";
  estimatedQRAs?: number | "";
  grossCredit?: number | "";
  w2Wages?: number | "";
  contractResearch?: number | "";
  supplies?: number | "";
  otherQualified?: number | "";
  notes?: string;
}

/** A person/contact stored on the lead's `data.people[]`. Frontend-managed
 *  (the backend persists `data` as a free-form JSON blob). */
export interface LeadDataPerson {
  id: string;
  /** Source person id (people.idperson) when seeded from the client graph. */
  personId?: number;
  firstName: string;
  lastName: string;
  /** Job title and firm, seeded from the people record. */
  title?: string;
  firm?: string;
  role: string;
  /** A person has one-to-many emails and phones (no labels — just values),
   *  mirroring the backend people_email / people_phone tables. */
  emails: string[];
  phones: string[];
}

export type TaxYearStatus = "current" | "current_engaged" | "engaged" | "eligible_not_engaged" | "not_eligible";

export interface TaxYearRecord {
  status: TaxYearStatus;
  notEligibleReason?: string;
  /** Name of the rep who marked not-eligible */
  notEligibleBy?: string;
  /** ISO timestamp of when not-eligible was set */
  notEligibleAt?: string;
  /** Optional note for any other status change */
  changeNote?: string;
  changedBy?: string;
  changedAt?: string;
}

/** Raw per-lead aggregate stored in the backend `crm_leads.data` column and
 *  echoed by GET/POST/PATCH /leads. */
export interface LeadData {
  people: LeadDataPerson[];
  /** Master entity list (names) for the client; seeds each year's calculation. */
  entities: LeadDataEntity[];
  /** Keyed by tax year (e.g. "2021"). Each year holds its own calculation —
   *  an array of the calculator's entity cards (Entity[]) once saved, or an
   *  empty array before the calculator has been opened for that year. */
  calculations: Record<string, Entity[] | unknown>;
  /** Many-to-many links between entities and people, keyed by entity id
   *  (LeadDataEntity.id) → array of person ids (LeadDataPerson.id). The reverse
   *  view (a person's entities) is derived from this single source of truth. */
  entityPeople?: Record<string, string[]>;
  filingStatus?: FilingStatus;
  /** Per-year R&D eligibility status overrides. Keyed by year as a string. */
  yearStatuses?: Record<string, TaxYearRecord>;
}

/** Default value for `LeadData.calculations`: an empty array (the persisted
 *  shape before any year is engaged), typed as the year-keyed map so
 *  `calculations[year]` reads stay sound. An empty `[]` and an empty `{}` are
 *  equivalent for keyed access, but the data contract uses `[]`. */
export const EMPTY_CALCULATIONS: LeadData["calculations"] =
  [] as unknown as LeadData["calculations"];

export interface Lead {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  rep: SalesRep;
  /** Backend user id of the assigned salesperson, if any. */
  repId?: number | null;
  /** Optional assignments — backend user id + display name, if assigned. */
  salesManagerId?: number | null;
  salesManagerName?: string;
  trainingManagerId?: number | null;
  trainingManagerName?: string;
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
  /** Raw `data` aggregate from the backend (people, entities, calculations). */
  data?: LeadData;
  latestCalculation: string;
  addedAt: string;
  notes?: string;
  intakeNotes?: ProfileNote[];
  intake?: IntakeAnswers;
  nextCall?: NextCallInfo | null;
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
  assignedRepName?: string | null;
  completed?: boolean;
  /** Pipeline stage this call works (mirrors the lead's status at creation). */
  callType?: LeadStatus;
}

export interface NextCallInfo {
  date: string;
  time?: string | null;
  callType?: string | null;
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
