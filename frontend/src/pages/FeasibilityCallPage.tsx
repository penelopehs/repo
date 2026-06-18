// Feasibility Call — 3-step guided workflow (Call Setup → BCM v1 Builder → Output)
// Data persists in localStorage keyed by leadId so reps can resume across sessions.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Copy,
  Download,
  FileBarChart2,
  FileText,
  LayoutGrid,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { feasibilityApi } from "@/services/feasibility";
import { useLeadsStore } from "@/store/leadsStore";
import type { TaxYear } from "@/types/crm";
import type { FeasibilityEntity } from "@/types/feasibility";

// ── Types ─────────────────────────────────────────────────────────────────────

type QualStatus = "" | "possible" | "strong" | "clarify";

type FCEntity = FeasibilityEntity;

interface BCMComponent {
  id: string;
  headerName: string;
  name: string;
  description: string;
  timeframe: string;
  entities: FCEntity[];
  mainContact: string;
  whatSalesHeard: string;
  generalAreas: string[];
  discoveryShouldExplore: string;
  qualificationStatus: QualStatus;
}

interface FCSetup {
  doctorName: string;
  practiceName: string;
  practiceType: string;
  taxYear: string;
  salesRep: string;
  callDate: string;
  referredBy: string;
  taxPreparerFirst: string;
  taxPreparerMiddle: string;
  taxPreparerLast: string;
  numLocations: string;
  numEmployees: string;
}

interface FeasibilityCallDraft {
  id: string;
  leadId: string;
  createdAt: string;
  updatedAt: string;
  currentStep: 1 | 2 | 3;
  setup: FCSetup;
  components: BCMComponent[];
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "fc_drafts";

function loadAllDrafts(): Record<string, FeasibilityCallDraft[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, FeasibilityCallDraft[]>) : {};
  } catch {
    return {};
  }
}

// Forwards old single-field taxPreparer drafts to the current three-field shape.
function migrateDraft(draft: FeasibilityCallDraft): FeasibilityCallDraft {
  const setup = draft.setup as FCSetup & { taxPreparer?: string };
  if (setup.taxPreparerFirst !== undefined) return draft;
  const parts = (setup.taxPreparer ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    ...draft,
    setup: {
      ...setup,
      taxPreparerFirst: parts[0] ?? "",
      taxPreparerMiddle: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
      taxPreparerLast: parts.length > 1 ? parts[parts.length - 1] : "",
    },
  };
}

// Coerces a raw stored entity value (may be a plain string from old drafts) into
// a proper FCEntity object.
function normalizeEntity(raw: unknown, index: number): FCEntity | null {
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return { id: -(index + 1), name };
  }
  if (raw && typeof raw === "object" && "name" in raw) {
    const e = raw as Partial<FCEntity>;
    const name = (typeof e.name === "string" ? e.name : "").trim();
    if (!name) return null;
    return {
      id: typeof e.id === "number" ? e.id : -(index + 1),
      name,
      type: e.type ?? undefined,
      city: e.city ?? undefined,
      state: e.state ?? undefined,
    };
  }
  return null;
}

function normalizeComponent(comp: BCMComponent): BCMComponent {
  const entities = (comp.entities ?? [])
    .map((e, i) => normalizeEntity(e as unknown, i))
    .filter((e): e is FCEntity => e !== null);
  return { ...comp, entities };
}

// Runs both migrations in sequence: taxPreparer split → entity object coercion.
function normalizeDraft(draft: FeasibilityCallDraft): FeasibilityCallDraft {
  const migrated = migrateDraft(draft);
  return {
    ...migrated,
    components: (migrated.components ?? []).map(normalizeComponent),
  };
}

export function loadDraftsForLead(leadId: string): FeasibilityCallDraft[] {
  return (loadAllDrafts()[leadId] ?? []).map(normalizeDraft);
}

function saveDraft(draft: FeasibilityCallDraft): FeasibilityCallDraft {
  const all = loadAllDrafts();
  const list = all[draft.leadId] ?? [];
  const idx = list.findIndex((d) => d.id === draft.id);
  const updated: FeasibilityCallDraft = {
    ...normalizeDraft(draft),
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = updated;
  else list.unshift(updated);
  all[draft.leadId] = list;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return updated;
}

function deleteDraft(leadId: string, draftId: string): FeasibilityCallDraft[] {
  const all = loadAllDrafts();
  const remaining = (all[leadId] ?? []).filter((d) => d.id !== draftId);
  all[leadId] = remaining;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return remaining.map(normalizeDraft);
}

function makeEmptyComponent(): BCMComponent {
  return {
    id: crypto.randomUUID(),
    headerName: "",
    name: "",
    description: "",
    timeframe: "",
    entities: [],
    mainContact: "",
    whatSalesHeard: "",
    generalAreas: [],
    discoveryShouldExplore: "",
    qualificationStatus: "",
  };
}

function makeNewDraft(
  leadId: string,
  leadName?: string,
  company?: string,
  taxYears?: TaxYear[],
  source?: string,
  salesRep?: string,
): FeasibilityCallDraft {
  const now = new Date().toISOString();
  const defaultTaxYear =
    taxYears && taxYears.length > 0 ? String(taxYears[0]) : String(new Date().getFullYear() - 1);
  return {
    id: crypto.randomUUID(),
    leadId,
    createdAt: now,
    updatedAt: now,
    currentStep: 1,
    setup: {
      doctorName: leadName ?? "",
      practiceName: company ?? "",
      practiceType: "",
      taxYear: defaultTaxYear,
      salesRep: salesRep && salesRep !== "Unassigned" ? salesRep : "",
      callDate: new Date().toISOString().slice(0, 10),
      referredBy: source ?? "",
      taxPreparerFirst: "",
      taxPreparerMiddle: "",
      taxPreparerLast: "",
      numLocations: "",
      numEmployees: "",
    },
    components: [makeEmptyComponent(), makeEmptyComponent(), makeEmptyComponent()],
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

const PRACTICE_TYPES = [
  "Medical — General Practice",
  "Medical — Specialty / Surgery",
  "Dental / Oral Surgery",
  "Ophthalmology",
  "Orthopedics",
  "Dermatology",
  "Cardiology",
  "Interventional / Pain Management",
  "Aesthetic / Med Spa",
  "Other",
];

const MAX_BCM_COLUMNS = 8;

const GENERAL_AREAS = [
  "Clinical Procedures",
  "Surgical Techniques",
  "Diagnostics & Imaging",
  "Dental Procedures",
  "Orthodontics & Prosthodontics",
  "Oral Surgery",
  "Anesthesia & Sedation",
  "Sterilization & Infection Control",
  "Medical Devices & Equipment",
  "Pharmaceuticals & Medications",
  "Patient Care Workflows",
  "Electronic Health Records (EHR)",
  "Lab & Pathology",
  "Radiology",
  "Preventive Care",
  "Specialty Treatments",
  "Staff Training & Protocols",
  "Regulatory Compliance",
];

const ENTITY_TYPES = ["LLC", "PLLC", "S-Corp", "C-Corp", "Sole Proprietor", "Partnership"];

const ENTITY_COLORS = [
  "#185FA5",
  "#0F6E56",
  "#854F0B",
  "#534AB7",
  "#993C1D",
  "#3B6D11",
  "#C94040",
  "#7B5EA7",
];

type BCMRowKey = keyof BCMComponent | "entities" | "generalAreas" | "qualificationStatus";

const BCM_ROWS: {
  key: BCMRowKey;
  label: string;
  sub?: string;
  type: "input" | "textarea" | "entity" | "areas" | "status";
  placeholder?: string;
  large?: boolean;
}[] = [
  {
    key: "description",
    label: "Brief Description",
    sub: "Process or activity",
    type: "textarea",
    placeholder: "Describe the process, activity, or improvement…",
    large: true,
  },
  {
    key: "timeframe",
    label: "Timeframe",
    sub: "Stay within the tax year",
    type: "input",
    placeholder: "e.g. Q1–Q3 2023, Jan–Sep 2023",
  },
  {
    key: "entities",
    label: "Entities Applicable",
    sub: "Search or add entity",
    type: "entity",
  },
  {
    key: "mainContact",
    label: "Main Contact / Doctor",
    sub: "Who to reference",
    type: "input",
    placeholder: "Name and role…",
  },
  {
    key: "whatSalesHeard",
    label: "What Sales Heard",
    sub: "Direct call notes",
    type: "textarea",
    placeholder: "Capture the doctor's own words and context…",
    large: true,
  },
  {
    key: "generalAreas",
    label: "General Area of Work",
    sub: "Select all that apply",
    type: "areas",
  },
  {
    key: "discoveryShouldExplore",
    label: "Discovery Should Explore",
    sub: "Notes for technical team",
    type: "textarea",
    placeholder: "What technical questions should Discovery dig into?",
    large: true,
  },
  {
    key: "qualificationStatus",
    label: "Qualification Status",
    sub: "Sales rep estimate only",
    type: "status",
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export function FeasibilityCallPage({ leadId, callId }: { leadId: string; callId?: string }) {
  const navigate = useNavigate();
  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === leadId));
  const [draft, setDraft] = useState<FeasibilityCallDraft | null>(null);
  const [allDrafts, setAllDrafts] = useState<FeasibilityCallDraft[]>([]);
  const [showDraftList, setShowDraftList] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [outputReady, setOutputReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    const drafts = loadDraftsForLead(leadId);

    let active: FeasibilityCallDraft;
    if (callId === "new" || drafts.length === 0) {
      // Create a fresh draft and immediately replace the URL with its UUID so
      // that refreshing the page resumes this draft instead of spawning another.
      active = saveDraft(
        makeNewDraft(
          leadId,
          lead?.fullName ?? "",
          lead?.company ?? "",
          lead?.taxYears,
          lead?.source,
          lead?.rep,
        ),
      );
      navigate({
        to: "/clients/$id/feasibility-call",
        params: { id: leadId },
        search: { callId: active.id },
        replace: true,
      });
    } else if (callId && callId !== "new") {
      active = drafts.find((d) => d.id === callId) ?? drafts[0];
    } else {
      active = drafts[0];
    }

    setDraft(active);
    setAllDrafts(loadDraftsForLead(leadId));
  }, [leadId, callId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const persist = useCallback((d: FeasibilityCallDraft) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveDraft(d);
      setAllDrafts(loadDraftsForLead(d.leadId));
      setSavedFlash(true);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setSavedFlash(false), 2000);
    }, 400);
  }, []);

  const patchDraft = useCallback(
    (changes: Partial<FeasibilityCallDraft>) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...changes };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const patchSetup = useCallback(
    (field: keyof FCSetup, value: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = { ...prev, setup: { ...prev.setup, [field]: value } };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const patchComponents = useCallback(
    (components: BCMComponent[]) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = { ...prev, components };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const goTo = (step: 1 | 2 | 3) => {
    setOutputReady(false);
    patchDraft({ currentStep: step });
  };

  const resetAfterSubmit = useCallback(() => {
    setOutputReady(false);
    patchDraft({
      components: [makeEmptyComponent(), makeEmptyComponent(), makeEmptyComponent()],
      currentStep: 1,
    });
  }, [patchDraft]);

  const startNewCall = () => {
    if (!window.confirm("Start a new feasibility call for this client?")) return;
    const fresh = saveDraft(
      makeNewDraft(
        leadId,
        lead?.fullName ?? "",
        lead?.company ?? "",
        lead?.taxYears,
        lead?.source,
        lead?.rep,
      ),
    );
    setDraft(fresh);
    setAllDrafts(loadDraftsForLead(leadId));
    setOutputReady(false);
    setShowDraftList(false);
  };

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setOutputReady(true);
    }, 800);
  };

  if (!draft) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const step = draft.currentStep;

  const fmtDateTime = (iso: string) => {
    const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
    return (
      d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) +
      " at " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  };

  const formatDraftLabel = (d: FeasibilityCallDraft) => {
    const name = d.setup.practiceName || d.setup.doctorName;
    const ty = d.setup.taxYear || "—";
    return name ? `${name} — TY ${ty}` : `Tax Year ${ty}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky phase bar ───────────────────────────────────────────── */}
      <div className="sticky top-16 z-30 bg-navy shadow-elevated">
        {/* Top strip: back + title + actions */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate({ to: "/clients/$id", params: { id: leadId } })}
              className="flex shrink-0 items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to profile
            </button>
            <span className="text-white/20">|</span>
            <span className="truncate text-sm font-medium text-white/80">
              Feasibility Call
              {lead?.fullName && <span className="text-white/40"> · {lead.fullName}</span>}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Autosave flash */}
            <span
              className={cn(
                "text-xs font-medium text-green transition-opacity duration-500",
                savedFlash ? "opacity-100" : "opacity-0",
              )}
            >
              Saved ✓
            </span>

            {/* Draft picker */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowDraftList((p) => !p);
                  setManageMode(false);
                }}
                className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs text-white/65 transition-colors hover:bg-white/15 hover:text-white"
              >
                <FileText className="h-3 w-3" />
                {allDrafts.length > 1 ? `${allDrafts.length} drafts` : "Drafts"}
                <ChevronDown className="h-3 w-3" />
              </button>

              {showDraftList && (
                <div
                  className="absolute right-0 top-full z-50 mt-1 min-w-64 overflow-hidden rounded-lg border border-border bg-card shadow-elevated"
                  style={{ maxHeight: "70vh" }}
                >
                  {/* Manage header */}
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Draft History
                    </span>
                    <button
                      onClick={() => setManageMode((p) => !p)}
                      className={cn(
                        "text-[11px] font-medium transition-colors",
                        manageMode ? "text-cyan" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {manageMode ? "Done" : "Manage"}
                    </button>
                  </div>

                  <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 72px)" }}>
                    {allDrafts.map((d) => (
                      <div
                        key={d.id}
                        className={cn(
                          "flex items-center border-b border-border last:border-0",
                          d.id === draft.id && "bg-accent",
                        )}
                      >
                        <button
                          onClick={() => {
                            if (manageMode) return;
                            setDraft(d);
                            setShowDraftList(false);
                            setManageMode(false);
                            setOutputReady(false);
                          }}
                          className="flex min-w-0 flex-1 flex-col items-start px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                        >
                          <span className="font-medium text-foreground">{formatDraftLabel(d)}</span>
                          <span className="font-medium text-cyan">
                            {fmtDateTime(d.updatedAt || d.createdAt)}
                          </span>
                          <span className="text-muted-foreground">
                            Step {d.currentStep} of 3 ·{" "}
                            {d.components.filter((c) => c.headerName || c.name).length} component
                            {d.components.filter((c) => c.headerName || c.name).length !== 1
                              ? "s"
                              : ""}
                          </span>
                        </button>
                        {manageMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const remaining = deleteDraft(leadId, d.id);
                              setAllDrafts(remaining);
                              if (draft && d.id === draft.id) {
                                if (remaining.length > 0) {
                                  setDraft(remaining[0]);
                                } else {
                                  const fresh = saveDraft(
                                    makeNewDraft(
                                      leadId,
                                      lead?.fullName ?? "",
                                      lead?.company ?? "",
                                      lead?.taxYears,
                                      lead?.source,
                                      lead?.rep,
                                    ),
                                  );
                                  setDraft(fresh);
                                  setAllDrafts([fresh]);
                                  setShowDraftList(false);
                                  setManageMode(false);
                                }
                              }
                            }}
                            className="shrink-0 px-3 py-2 text-muted-foreground transition-colors hover:text-destructive"
                            title="Delete this draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {!manageMode && (
                    <button
                      onClick={startNewCall}
                      className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-cyan transition-colors hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" />
                      New call
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (step === 3 && outputReady) return;
                const hasComponents = draft.components.some((c) => (c.headerName || c.name).trim());
                goTo(3);
                if (hasComponents) generate();
              }}
              className="flex items-center gap-1.5 rounded-md border border-cyan/30 bg-cyan/[0.12] px-3 py-1.5 text-xs font-medium text-cyan transition-colors hover:bg-cyan/20"
            >
              <FileText className="h-3 w-3" />
              View Output
            </button>
          </div>
        </div>

        {/* Phase tabs */}
        <div className="flex overflow-x-auto">
          {(
            [
              { n: 1, label: "Call Setup" },
              { n: 2, label: "Business Component Map v1" },
              { n: 3, label: "Feasibility Output" },
            ] as const
          ).map(({ n, label }) => (
            <button
              key={n}
              onClick={() => goTo(n)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3 text-xs font-medium transition-colors",
                step === n
                  ? "border-cyan bg-white/10 font-semibold text-cyan"
                  : step > n
                    ? "border-transparent text-green hover:text-white/75"
                    : "border-transparent text-white/45 hover:text-white/75",
              )}
            >
              <span
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  step === n
                    ? "bg-cyan text-navy"
                    : step > n
                      ? "bg-green text-white"
                      : "bg-white/10 text-white/50",
                )}
              >
                {step > n ? "✓" : n}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className={cn("mx-auto px-4 py-7 sm:px-6", step === 2 ? "max-w-[1400px]" : "max-w-5xl")}>
        {step === 1 && (
          <CallSetupStep
            setup={draft.setup}
            taxYears={lead?.taxYears}
            onUpdate={patchSetup}
            onNext={() => goTo(2)}
          />
        )}
        {step === 2 && (
          <BCMBuilderStep
            leadId={leadId}
            components={draft.components}
            onUpdate={patchComponents}
            onBack={() => goTo(1)}
            onNext={() => goTo(3)}
          />
        )}
        {step === 3 && (
          <FeasibilityOutputStep
            draft={draft}
            outputReady={outputReady}
            generating={generating}
            onGenerate={generate}
            onBack={() => goTo(2)}
            onSubmit={resetAfterSubmit}
          />
        )}
      </div>
    </div>
  );
}

// ── Step 1: Call Setup ────────────────────────────────────────────────────────

function CallSetupStep({
  setup,
  taxYears,
  onUpdate,
  onNext,
}: {
  setup: FCSetup;
  taxYears?: TaxYear[];
  onUpdate: (field: keyof FCSetup, value: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Call Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture context before the call. This is <em>not</em> a technical intake.
          </p>
        </div>
        <StepTag>Step 1 of 3</StepTag>
      </div>

      <div className="mb-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MF label="Doctor / Client Name">
            <Input
              placeholder="Dr. Jane Smith"
              value={setup.doctorName}
              onChange={(e) => onUpdate("doctorName", e.target.value)}
            />
          </MF>
          <MF label="Practice Name">
            <Input
              placeholder="Smith Orthopedic Group"
              value={setup.practiceName}
              onChange={(e) => onUpdate("practiceName", e.target.value)}
            />
          </MF>
          <MF label="Practice Type">
            <NativeSelect
              value={setup.practiceType}
              onChange={(e) => onUpdate("practiceType", e.target.value)}
            >
              <option value="">Select type…</option>
              {PRACTICE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </MF>
          <MF label="Tax Year Being Evaluated">
            {taxYears && taxYears.length > 0 ? (
              (() => {
                const selectedYears = setup.taxYear
                  ? setup.taxYear.split(",").map((y) => y.trim()).filter(Boolean)
                  : [];
                const toggle = (year: string) => {
                  const isSelected = selectedYears.includes(year);
                  const next = isSelected
                    ? selectedYears.filter((y) => y !== year)
                    : [...selectedYears, year];
                  onUpdate("taxYear", next.join(", "));
                };
                return (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {taxYears.map((y) => {
                      const yr = String(y);
                      const active = selectedYears.includes(yr);
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => toggle(yr)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            active
                              ? "border-cyan/50 bg-cyan/10 text-cyan"
                              : "border-border text-muted-foreground hover:border-cyan/40 hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <Input
                placeholder="2023"
                value={setup.taxYear}
                onChange={(e) => onUpdate("taxYear", e.target.value)}
              />
            )}
          </MF>
          <MF label="Sales Representative">
            <Input
              placeholder="Your name"
              value={setup.salesRep}
              onChange={(e) => onUpdate("salesRep", e.target.value)}
            />
          </MF>
          <MF label="Call Date">
            <Input
              type="date"
              value={setup.callDate}
              onChange={(e) => onUpdate("callDate", e.target.value)}
            />
          </MF>
        </div>
      </div>

      <SL>Referral &amp; Preparer Info</SL>
      <div className="mb-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <MF label="Referred By">
            <Input
              placeholder="CPA, colleague, seminar…"
              value={setup.referredBy}
              onChange={(e) => onUpdate("referredBy", e.target.value)}
            />
          </MF>
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Tax Preparer / CPA
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="First name"
                value={setup.taxPreparerFirst}
                onChange={(e) => onUpdate("taxPreparerFirst", e.target.value)}
              />
              <Input
                placeholder="Middle name"
                value={setup.taxPreparerMiddle}
                onChange={(e) => onUpdate("taxPreparerMiddle", e.target.value)}
              />
              <Input
                placeholder="Last name"
                value={setup.taxPreparerLast}
                onChange={(e) => onUpdate("taxPreparerLast", e.target.value)}
              />
            </div>
          </div>
          <MF label="No. of Locations">
            <Input
              type="number"
              min="1"
              placeholder="1"
              value={setup.numLocations}
              onChange={(e) => onUpdate("numLocations", e.target.value)}
            />
          </MF>
          <MF label="Estimated Employees">
            <Input
              placeholder="e.g. 5–15"
              value={setup.numEmployees}
              onChange={(e) => onUpdate("numEmployees", e.target.value)}
            />
          </MF>
        </div>
      </div>

      <SL>Call Objective</SL>
      <div className="mb-7 flex flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-card sm:flex-row sm:gap-6">
        <div className="flex-1">
          <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-green text-base leading-none">✓</span>
            This call IS for:
          </h4>
          <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {[
              "Understanding the doctor and their business",
              "Listening for areas of innovation & change",
              "Identifying entities and locations",
              "Helping the tax preparer see the opportunity",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1 shrink-0 text-muted-foreground">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden w-px bg-border sm:block" />
        <div className="flex-1">
          <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-destructive text-base leading-none">✗</span>
            This call is NOT for:
          </h4>
          <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {[
              "Technical qualification or deep R&D analysis",
              "Detailed methodology review",
              "Making final credit estimates",
              "Tax or legal advice — that belongs to Discovery",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1 shrink-0 text-muted-foreground">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            if (!setup.doctorName.trim() && !setup.practiceName.trim()) {
              toast.error("Enter a Doctor Name or Practice Name before continuing.");
              return;
            }
            onNext();
          }}
          className="gap-2"
        >
          Build BCM v1 <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Business Component Map v1 ────────────────────────────────────────

function BCMEntityPicker({
  selected,
  onChange,
  leadEntities,
  onAddNew,
}: {
  selected: FCEntity[];
  onChange: (entities: FCEntity[]) => void;
  leadEntities: FCEntity[];
  onAddNew: (prefill?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leadEntities.filter(
      (e) => !selected.some((s) => s.id === e.id) && (!q || e.name.toLowerCase().includes(q)),
    );
  }, [query, leadEntities, selected]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const addEntity = (entity: FCEntity) => {
    if (selected.some((s) => s.id === entity.id)) return;
    onChange([...selected, entity]);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="mb-1 flex flex-wrap gap-1">
        {selected.map((e) => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1 rounded-md border-2 border-cyan/50 bg-cyan/20 px-2 py-0.5 text-[10px] font-semibold text-foreground"
          >
            {e.name}
            <button
              type="button"
              onClick={() => onChange(selected.filter((s) => s.id !== e.id))}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${e.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20"
        placeholder="Search entities…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-elevated">
          {results.length > 0 && (
            <>
              <p className="bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Client Entities
              </p>
              {results.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-xs hover:bg-accent"
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    addEntity(e);
                  }}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    {e.name}{" "}
                    <span className="text-[10px] text-muted-foreground">
                      {[e.city, e.state].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
          {results.length === 0 && query.trim() && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matching client entities.</p>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-cyan hover:bg-accent"
            onMouseDown={(ev) => {
              ev.preventDefault();
              setOpen(false);
              onAddNew(query.trim() || undefined);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add new entity{query.trim() ? `: "${query.trim()}"` : "…"}
          </button>
        </div>
      )}
    </div>
  );
}

function BCMEntityModal({
  open,
  leadId,
  prefillName,
  onClose,
  onCreated,
}: {
  open: boolean;
  leadId: string;
  prefillName?: string;
  onClose: () => void;
  onCreated: (entity: FCEntity) => void;
}) {
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [ein, setEin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(prefillName ?? "");
      setEntityType("");
      setState("");
      setCity("");
      setEin("");
    }
  }, [open, prefillName]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Entity name is required.");
      return;
    }
    setSaving(true);
    try {
      const entity = await feasibilityApi.createEntity(leadId, {
        name: trimmed,
        entity_type: entityType || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        ein: ein.trim() || undefined,
      });
      onCreated(entity);
      onClose();
      toast.success("Entity added.");
    } catch {
      toast.error("Failed to add entity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Entity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Entity / Practice Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smith Orthopedic LLC"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Entity Type</Label>
            <NativeSelect value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">Select…</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. MI"
              />
            </div>
            <div className="space-y-1.5">
              <Label>City / Location</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Ann Arbor"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>EIN (optional)</Label>
            <Input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Entity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BCMAreaPills({
  areas,
  selected,
  onToggle,
  onAddCustom,
}: {
  areas: string[];
  selected: string[];
  onToggle: (area: string) => void;
  onAddCustom: (area: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const cancelledRef = useRef(false);

  const confirmCustom = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const val = custom.trim();
    setAdding(false);
    setCustom("");
    if (val) onAddCustom(val);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {areas.map((a) => {
        const on = selected.includes(a);
        return (
          <button
            key={a}
            type="button"
            onClick={() => onToggle(a)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
              on
                ? "border-cyan bg-cyan/25 font-semibold text-foreground shadow-sm ring-2 ring-cyan/35"
                : "border-border text-muted-foreground hover:border-cyan/50 hover:bg-cyan/10 hover:text-foreground",
            )}
          >
            {a}
          </button>
        );
      })}
      {adding ? (
        <input
          className="w-32 rounded-full border border-cyan px-2.5 py-0.5 text-[11px] outline-none"
          placeholder="New area…"
          value={custom}
          autoFocus
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmCustom();
            if (e.key === "Escape") {
              cancelledRef.current = true;
              setAdding(false);
              setCustom("");
            }
          }}
          onBlur={() => window.setTimeout(confirmCustom, 150)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-cyan px-2.5 py-0.5 text-[11px] text-cyan hover:bg-accent"
        >
          + Add Area
        </button>
      )}
    </div>
  );
}

const TEXT_FIELD_KEYS = new Set<keyof BCMComponent>([
  "name",
  "description",
  "timeframe",
  "mainContact",
  "whatSalesHeard",
  "discoveryShouldExplore",
]);

function countFilledRows(comp: BCMComponent): number {
  let n = 0;
  if (comp.description.trim()) n++;
  if (comp.timeframe.trim()) n++;
  if (comp.entities.length > 0) n++;
  if (comp.mainContact.trim()) n++;
  if (comp.whatSalesHeard.trim()) n++;
  if (comp.generalAreas.length > 0) n++;
  if (comp.discoveryShouldExplore.trim()) n++;
  if (comp.qualificationStatus) n++;
  return n;
}

function BCMBuilderStep({
  leadId,
  components,
  onUpdate,
  onBack,
  onNext,
}: {
  leadId: string;
  components: BCMComponent[];
  onUpdate: (components: BCMComponent[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === leadId));
  const fetchLead = useLeadsStore((s) => s.fetchLead);
  const leadEntities: FCEntity[] = useMemo(
    () =>
      (lead?.data?.entities ?? []).map((e, i) => ({
        id: e.entityId ?? -(i + 1),
        name: e.name,
        city: e.city,
        state: e.state,
      })),
    [lead],
  );
  const [entityModal, setEntityModal] = useState<{
    open: boolean;
    colIndex: number;
    prefill?: string;
  }>({ open: false, colIndex: 0 });
  // Derive custom areas from what's already saved in components so they survive tab navigation.
  const extraAreas = useMemo(() => {
    const custom = new Set<string>();
    for (const comp of components) {
      for (const area of comp.generalAreas) {
        if (!GENERAL_AREAS.includes(area)) custom.add(area);
      }
    }
    return [...custom];
  }, [components]);
  const allAreas = [...GENERAL_AREAS, ...extraAreas];

  const updateComponent = useCallback(
    (index: number, patch: Partial<BCMComponent>) => {
      onUpdate(components.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    },
    [components, onUpdate],
  );

  const syncHeaderName = (index: number, header: string) => {
    updateComponent(index, { headerName: header });
  };

  const addColumn = () => {
    if (components.length >= MAX_BCM_COLUMNS) {
      toast.error(`Maximum ${MAX_BCM_COLUMNS} business components.`);
      return;
    }
    onUpdate([...components, makeEmptyComponent()]);
  };

  const deleteColumn = (index: number) => {
    if (components.length <= 1) {
      toast.error("Must have at least one business component.");
      return;
    }
    onUpdate(components.filter((_, i) => i !== index));
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= components.length) return;
    const next = [...components];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdate(next);
  };

  const handleEntityCreated = (entity: FCEntity) => {
    const idx = entityModal.colIndex;
    const comp = components[idx];
    if (!comp) return;
    updateComponent(idx, { entities: [...comp.entities, entity] });
    void fetchLead(leadId);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Business Component Map v1
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One column per business component. Keep timeframes within the tax year.
          </p>
        </div>
        <StepTag>Step 2 of 3</StepTag>
      </div>

      <div className="mb-4 overflow-x-auto rounded-xl border border-border shadow-elevated">
        <table className="w-full min-w-[800px] border-collapse bg-card">
          <thead>
            <tr className="bg-navy">
              <td className="sticky left-0 z-10 w-40 min-w-[150px] border-r-[3px] border-r-cyan bg-navy p-3 align-middle text-[10px] uppercase tracking-wide text-white/50">
                <LayoutGrid className="mb-1 h-5 w-5 opacity-60" />
                Field
              </td>
              {components.map((col, i) => {
                const filled = countFilledRows(col);
                const total = BCM_ROWS.length;
                return (
                  <td key={col.id} className="min-w-[220px] border-l border-white/10 p-3 align-top">
                    {/* Reorder + delete controls */}
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveColumn(i, -1)}
                          disabled={i === 0}
                          className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-white/35 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                          title="Move left"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColumn(i, 1)}
                          disabled={i === components.length - 1}
                          className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-white/35 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                          title="Move right"
                        >
                          →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteColumn(i)}
                        className="flex h-5 w-5 items-center justify-center rounded text-white/25 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="Remove this component"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Column label + name textarea */}
                    <span className="mb-1 block text-center text-[9px] uppercase tracking-wider text-white/45">
                      Business Component {i + 1}
                    </span>
                    <textarea
                      className="w-full resize-none border-none bg-transparent text-center text-sm font-semibold text-white outline-none placeholder:text-white/35"
                      rows={2}
                      placeholder="Component name…"
                      value={col.headerName}
                      onChange={(e) => syncHeaderName(i, e.target.value)}
                    />

                    {/* Progress dots */}
                    <div className="mt-2 flex items-center justify-center gap-1.5">
                      <div className="flex gap-0.5">
                        {Array.from({ length: total }).map((_, di) => (
                          <span
                            key={di}
                            className={cn(
                              "h-1 w-1 rounded-full",
                              di < filled ? "bg-cyan" : "bg-white/20",
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] text-white/35">
                        {filled}/{total}
                      </span>
                    </div>
                  </td>
                );
              })}
              {/* Add-column button as a sticky last header cell */}
              {components.length < MAX_BCM_COLUMNS && (
                <td className="w-12 border-l border-white/10 p-2 align-middle">
                  <button
                    type="button"
                    onClick={addColumn}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/50 bg-white/10 py-4 text-white transition-colors hover:border-white hover:bg-white/20"
                    title="Add business component"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-[9px] uppercase tracking-wider">Add</span>
                  </button>
                </td>
              )}
            </tr>
          </thead>
          <tbody>
            {BCM_ROWS.map((row, ri) => (
              <tr key={row.label} className={ri % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r-[3px] border-r-cyan p-3 text-[11px] font-semibold leading-snug",
                    row.type === "status" ? "bg-cyan text-navy" : "bg-navy text-white/90",
                  )}
                >
                  {row.label}
                  {row.sub && (
                    <span
                      className={cn(
                        "mt-0.5 block text-[9px] font-normal normal-case tracking-normal",
                        row.type === "status" ? "text-navy/50" : "text-white/45",
                      )}
                    >
                      {row.sub}
                    </span>
                  )}
                </td>
                {components.map((col, ci) => (
                  <td key={col.id} className="min-w-[220px] border-l border-border p-2 align-top">
                    {row.type === "entity" ? (
                      <BCMEntityPicker
                        selected={col.entities}
                        onChange={(entities) => updateComponent(ci, { entities })}
                        leadEntities={leadEntities}
                        onAddNew={(prefill) =>
                          setEntityModal({ open: true, colIndex: ci, prefill })
                        }
                      />
                    ) : row.type === "areas" ? (
                      <BCMAreaPills
                        areas={allAreas}
                        selected={col.generalAreas}
                        onToggle={(area) => {
                          const has = col.generalAreas.includes(area);
                          updateComponent(ci, {
                            generalAreas: has
                              ? col.generalAreas.filter((a) => a !== area)
                              : [...col.generalAreas, area],
                          });
                        }}
                        onAddCustom={(area) => {
                          if (!col.generalAreas.includes(area)) {
                            updateComponent(ci, {
                              generalAreas: [...col.generalAreas, area],
                            });
                          }
                        }}
                      />
                    ) : row.type === "status" ? (
                      <QualStatusSelect
                        value={col.qualificationStatus}
                        onChange={(v) => updateComponent(ci, { qualificationStatus: v })}
                      />
                    ) : (
                      <Textarea
                        className={cn(
                          "min-h-[48px] resize-y border-transparent bg-transparent text-xs focus:border-cyan focus:bg-background",
                          row.large && "min-h-[80px]",
                          row.type === "input" && "min-h-[34px]",
                        )}
                        placeholder={row.placeholder}
                        value={
                          TEXT_FIELD_KEYS.has(row.key as keyof BCMComponent)
                            ? String(col[row.key as keyof BCMComponent] ?? "")
                            : ""
                        }
                        onChange={(e) =>
                          updateComponent(ci, {
                            [row.key]: e.target.value,
                          } as Partial<BCMComponent>)
                        }
                      />
                    )}
                  </td>
                ))}
                {/* Spacer cell under the add-column header */}
                {components.length < MAX_BCM_COLUMNS && (
                  <td className="w-12 border-l border-border" />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-2">
          Generate Output <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <BCMEntityModal
        open={entityModal.open}
        leadId={leadId}
        prefillName={entityModal.prefill}
        onClose={() => setEntityModal({ open: false, colIndex: 0 })}
        onCreated={handleEntityCreated}
      />
    </div>
  );
}

// ── Qualification Status Select ───────────────────────────────────────────────

const QUAL_OPTIONS = [
  {
    value: "possible" as const,
    label: "Possible",
    Icon: CircleDashed,
    triggerCls: "border-amber-950 bg-amber-900 text-amber-100 font-medium",
    itemCls: "text-amber-900 focus:bg-amber-50 focus:text-amber-950",
    iconCls: "text-amber-900",
    badgeCls: "bg-amber-900 text-amber-100 border-amber-950",
  },
  {
    value: "strong" as const,
    label: "Strong",
    Icon: CheckCircle2,
    triggerCls: "border-emerald-950 bg-emerald-900 text-emerald-100 font-medium",
    itemCls: "text-emerald-900 focus:bg-emerald-50 focus:text-emerald-950",
    iconCls: "text-emerald-900",
    badgeCls: "bg-emerald-900 text-emerald-100 border-emerald-950",
  },
  {
    value: "clarify" as const,
    label: "Needs Clarification",
    Icon: AlertCircle,
    triggerCls: "border-rose-950 bg-rose-900 text-rose-100 font-medium",
    itemCls: "text-rose-900 focus:bg-rose-50 focus:text-rose-950",
    iconCls: "text-rose-900",
    badgeCls: "bg-rose-900 text-rose-100 border-rose-950",
  },
] as const;

function QualStatusSelect({
  value,
  onChange,
}: {
  value: QualStatus;
  onChange: (v: QualStatus) => void;
}) {
  const selected = QUAL_OPTIONS.find((o) => o.value === value);
  return (
    <Select value={value} onValueChange={(v) => onChange(v as QualStatus)}>
      <SelectTrigger
        className={cn(
          "h-auto w-full rounded-md border px-2.5 py-1.5 text-xs outline-none",
          selected ? selected.triggerCls : "border-input bg-background text-muted-foreground",
        )}
      >
        <span className="flex items-center gap-1.5">
          {selected ? (
            <>
              <selected.Icon className="h-3 w-3 shrink-0" />
              {selected.label}
            </>
          ) : (
            "— select —"
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        {QUAL_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className={opt.itemCls}>
            <span className="flex items-center gap-1.5">
              <opt.Icon className={cn("h-3.5 w-3.5 shrink-0", opt.iconCls)} />
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Step 3: Feasibility Output ────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  possible: "Possible",
  strong: "Strong",
  clarify: "Needs Clarification",
};
const STATUS_CLS: Record<string, string> = {
  possible: "bg-amber-900 text-amber-100 border-amber-950",
  strong: "bg-emerald-900 text-emerald-100 border-emerald-950",
  clarify: "bg-rose-900 text-rose-100 border-rose-950",
};
const STATUS_ICON: Record<string, typeof CircleDashed> = {
  possible: CircleDashed,
  strong: CheckCircle2,
  clarify: AlertCircle,
};

function FeasibilityOutputStep({
  draft,
  outputReady,
  generating,
  onGenerate,
  onBack,
  onSubmit,
}: {
  draft: FeasibilityCallDraft;
  outputReady: boolean;
  generating: boolean;
  onGenerate: () => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { setup, components } = draft;

  // Build a deduplicated entity list with colors for the entity map.
  const seenEntityIds = new Set<number>();
  const allEntities: Array<FCEntity & { color: string }> = [];
  let colorIndex = 0;
  for (const comp of components) {
    for (const ent of comp.entities) {
      if (seenEntityIds.has(ent.id)) continue;
      seenEntityIds.add(ent.id);
      allEntities.push({ ...ent, color: ENTITY_COLORS[colorIndex % ENTITY_COLORS.length] });
      colorIndex++;
    }
  }

  const namedComponents = components.filter((c) => (c.headerName || c.name).trim());

  const docName = setup.doctorName || "the physician";
  const practice = setup.practiceName || "their practice";
  const taxYear = setup.taxYear || "the tax year";
  const rep = setup.salesRep || "the sales representative";
  const pType = (setup.practiceType || "medical practice").toLowerCase();

  const outputRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    setSubmitted(true);
    try {
      await feasibilityApi.saveFeasibilityCall(draft.leadId, {
        call_setup: draft.setup,
        components: draft.components,
      });
      toast.success("Feasibility call saved.");
    } catch {
      toast.error("Failed to save — please try again.");
      setSubmitted(false);
      return;
    }
    setTimeout(() => onSubmit(), 900);
  };

  const buildSummaryText = () => {
    const dateStr = setup.callDate
      ? (() => {
          const [y, m, d] = setup.callDate.split("-").map(Number);
          return ` on ${new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
        })()
      : "";
    const lines: string[] = [
      `The following summary was prepared following a feasibility call with ${docName} of ${practice}, conducted by ${rep}${dateStr}, for tax year ${taxYear}.`,
      `This is a ${pType} practice${setup.numLocations ? ` operating across ${setup.numLocations} location(s)` : ""}${setup.numEmployees ? ` with approximately ${setup.numEmployees} employees` : ""}. The discovery conversation surfaced indicators of qualifying R&D activity during the evaluation period.`,
    ];
    if (namedComponents.length > 0) {
      lines.push(
        `A total of ${namedComponents.length} business component(s) were identified during this call and are detailed in the BCM v1 below. These components represent initial areas of potential qualification and should be validated by the Discovery team.`,
      );
    }
    lines.push(
      "A technical intake with the Discovery department is recommended as the next step to validate, quantify, and document qualifying activities. The BCM v1 components above serve as the initial brief for that handoff.",
    );
    return lines.join("\n\n");
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(buildSummaryText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const captureImage = async (): Promise<string | null> => {
    if (!outputRef.current) return null;
    const { toPng } = await import("html-to-image");
    return toPng(outputRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });
  };

  const handlePrint = () => {
    if (!outputReady) {
      toast.error("Generate the analysis first");
      return;
    }
    const style = document.createElement("style");
    style.textContent =
      "@media print{" +
      "body *{visibility:hidden;}" +
      "#fc-output-section,#fc-output-section *{visibility:visible;}" +
      "#fc-output-section{position:absolute;left:0;top:0;width:100%;}" +
      "@page{margin:10mm;size:A4 portrait;}" +
      "}";
    document.head.appendChild(style);
    setTimeout(() => {
      window.print();
      window.addEventListener("afterprint", () => style.remove(), { once: true });
    }, 200);
  };

  const handleDownloadPdf = async () => {
    if (!outputReady) {
      toast.error("Generate the analysis first");
      return;
    }
    setExporting(true);
    try {
      const dataUrl = await captureImage();
      if (!dataUrl) return;

      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageW - margin * 2;
      const ratio = img.naturalWidth / contentW;
      const scaledH = img.naturalHeight / ratio;
      const pageContentH = pageH - margin * 2;
      const totalPages = Math.ceil(scaledH / pageContentH);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", margin, margin - page * pageContentH, contentW, scaledH);
      }

      const slug = (practice !== "their practice" ? practice : docName)
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
        .replace(/^-+|-+$/g, "");
      pdf.save(`feasibility-${slug}-${taxYear}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error("Export failed — please try again");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Feasibility Output</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and share with your team and tax preparer.
          </p>
        </div>
        <StepTag>Step 3 of 3</StepTag>
      </div>

      <div className="mb-6">
        <Button
          onClick={onGenerate}
          disabled={generating || namedComponents.length === 0}
          className="gap-2"
        >
          {generating ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Building…
            </>
          ) : (
            <>
              <BarChart2 className="h-4 w-4" />
              {outputReady ? "Regenerate" : "Generate Analysis"}
            </>
          )}
        </Button>
        {namedComponents.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Name at least one component in Step 2 to enable.
          </p>
        )}
      </div>

      <div ref={outputRef} id="fc-output-section">
        {!outputReady && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
            <FileBarChart2 className="mb-3 h-9 w-9 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Generate Analysis&rdquo; to compile your feasibility output from the BCM
              v1 data.
            </p>
          </div>
        )}

        {outputReady && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Entity map */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-foreground">Entity Map</h2>
              {allEntities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No entities assigned yet.</p>
              ) : (
                <ul className="space-y-2">
                  {allEntities.map((ent) => (
                    <li
                      key={ent.id}
                      className="flex items-center gap-2.5 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: ent.color }}
                      />
                      <span>
                        <strong>{ent.name}</strong>{" "}
                        <span className="text-[11px] text-muted-foreground">
                          {ent.type ? `${ent.type} · ` : ""}
                          {[ent.city, ent.state].filter(Boolean).join(", ")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Preparer-Ready Summary */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">Preparer-Ready Summary</h2>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                  title="Copy summary to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2.5 text-sm leading-relaxed text-foreground">
                <p>
                  The following summary was prepared following a feasibility call with{" "}
                  <strong>{docName}</strong> of <strong>{practice}</strong>, conducted by {rep}
                  {setup.callDate
                    ? ` on ${(() => {
                        const [y, m, d] = setup.callDate.split("-").map(Number);
                        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        });
                      })()}`
                    : ""}
                  , for tax year <strong>{taxYear}</strong>.
                </p>
                <p>
                  This is a {pType} practice
                  {setup.numLocations ? ` operating across ${setup.numLocations} location(s)` : ""}
                  {setup.numEmployees ? ` with approximately ${setup.numEmployees} employees` : ""}.
                  The discovery conversation surfaced indicators of qualifying R&D activity during
                  the evaluation period.
                </p>
                {namedComponents.length > 0 && (
                  <p>
                    A total of <strong>{namedComponents.length} business component(s)</strong> were
                    identified during this call and are detailed in the BCM v1 below. These
                    components represent initial areas of potential qualification and should be
                    validated by the Discovery team.
                  </p>
                )}
                <p>
                  A technical intake with the Discovery department is recommended as the next step
                  to validate, quantify, and document qualifying activities. The BCM v1 components
                  above serve as the initial brief for that handoff.
                </p>
              </div>
            </div>

            {/* BCM Summary — full width */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:col-span-2">
              <h2 className="mb-4 text-lg font-bold text-foreground">BCM v1 — Component Summary</h2>
              {namedComponents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No business components defined yet.</p>
              ) : (
                <div className="space-y-3">
                  {namedComponents.map((comp) => {
                    const name = (comp.headerName || comp.name).trim();
                    const qs = comp.qualificationStatus;
                    return (
                      <div
                        key={comp.id}
                        className="rounded-lg border border-border bg-background p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm text-foreground">{name}</strong>
                          {qs &&
                            (() => {
                              const StatusIcon = STATUS_ICON[qs];
                              return (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                    STATUS_CLS[qs],
                                  )}
                                >
                                  {StatusIcon && <StatusIcon className="h-3 w-3 shrink-0" />}
                                  {STATUS_LABEL[qs]}
                                </span>
                              );
                            })()}
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                          {comp.description && (
                            <OutField full label="Description">
                              {comp.description}
                            </OutField>
                          )}
                          {comp.timeframe && (
                            <OutField label="Timeframe">{comp.timeframe}</OutField>
                          )}
                          {comp.entities.length > 0 && (
                            <OutField label="Entities">
                              {comp.entities.map((e) => e.name).join(", ")}
                            </OutField>
                          )}
                          {comp.mainContact && (
                            <OutField label="Main Contact">{comp.mainContact}</OutField>
                          )}
                          {comp.generalAreas.length > 0 && (
                            <OutField full label="General Area of Work">
                              {comp.generalAreas.join(" · ")}
                            </OutField>
                          )}
                          {comp.whatSalesHeard && (
                            <OutField full label="What Sales Heard">
                              {comp.whatSalesHeard}
                            </OutField>
                          )}
                          {comp.discoveryShouldExplore && (
                            <OutField full label="Discovery Should Explore">
                              {comp.discoveryShouldExplore}
                            </OutField>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to BCM
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={submitted}
          className={cn("gap-2 transition-opacity duration-500", submitted && "opacity-40")}
        >
          <Check className="h-4 w-4" />
          {submitted ? "Saved" : "Submit"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2" disabled={exporting}>
              <Printer className="h-4 w-4" />
              {exporting ? "Exporting…" : "Print / Export"}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf}>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Shared micro-components ───────────────────────────────────────────────────

function StepTag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-navy px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan dark:bg-white/10">
      {children}
    </span>
  );
}

function SL({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function MF({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function NativeSelect({
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
    >
      {children}
    </select>
  );
}

function OutField({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-3" : ""}>
      <span className="mb-0.5 block font-semibold text-foreground">{label}</span>
      {children}
    </div>
  );
}
