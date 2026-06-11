// Feasibility Call — 3-step guided workflow (Call Setup → BCM v1 Builder → Output)
// Data persists in localStorage keyed by leadId so reps can resume across sessions.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  FileText,
  Plus,
  Printer,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEngagementsStore } from "@/store/engagementsStore";
import { useLeadsStore } from "@/store/leadsStore";

// ── Types ─────────────────────────────────────────────────────────────────────

type QualStatus = "" | "possible" | "strong" | "clarify";

interface BCMComponent {
  id: string;
  headerName: string;
  name: string;
  description: string;
  timeframe: string;
  entities: string[];
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
  taxPreparer: string;
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

export function loadDraftsForLead(leadId: string): FeasibilityCallDraft[] {
  return loadAllDrafts()[leadId] ?? [];
}

function saveDraft(draft: FeasibilityCallDraft): FeasibilityCallDraft {
  const all = loadAllDrafts();
  const list = all[draft.leadId] ?? [];
  const idx = list.findIndex((d) => d.id === draft.id);
  const updated: FeasibilityCallDraft = { ...draft, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = updated;
  else list.unshift(updated);
  all[draft.leadId] = list;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return updated;
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
): FeasibilityCallDraft {
  const now = new Date().toISOString();
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
      taxYear: String(new Date().getFullYear() - 1),
      salesRep: "",
      callDate: new Date().toISOString().slice(0, 10),
      referredBy: "",
      taxPreparer: "",
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function FeasibilityCallPage({
  leadId,
  callId,
}: {
  leadId: string;
  callId?: string;
}) {
  const navigate = useNavigate();
  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === leadId));
  const [draft, setDraft] = useState<FeasibilityCallDraft | null>(null);
  const [allDrafts, setAllDrafts] = useState<FeasibilityCallDraft[]>([]);
  const [showDraftList, setShowDraftList] = useState(false);
  const [outputReady, setOutputReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const drafts = loadDraftsForLead(leadId);

    let active: FeasibilityCallDraft;
    if (callId === "new" || drafts.length === 0) {
      // Create a fresh draft and immediately replace the URL with its UUID so
      // that refreshing the page resumes this draft instead of spawning another.
      active = saveDraft(makeNewDraft(leadId, lead?.fullName ?? "", lead?.company ?? ""));
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

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const persist = useCallback((d: FeasibilityCallDraft) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveDraft(d);
      setAllDrafts(loadDraftsForLead(d.leadId));
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

  const goTo = (step: 1 | 2 | 3) => {
    setOutputReady(false);
    patchDraft({ currentStep: step });
  };

  const startNewCall = () => {
    if (!window.confirm("Start a new feasibility call for this client?")) return;
    const fresh = saveDraft(makeNewDraft(leadId, lead?.fullName ?? "", lead?.company ?? ""));
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

  const formatDraftLabel = (d: FeasibilityCallDraft) => {
    const date = d.setup.callDate || d.createdAt.slice(0, 10);
    const ty = d.setup.taxYear ? ` — TY ${d.setup.taxYear}` : "";
    return `${date}${ty}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky phase bar ───────────────────────────────────────────── */}
      <div className="sticky top-16 z-30 bg-navy shadow-elevated">
        {/* Top strip: back + title + actions */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() =>
                navigate({ to: "/clients/$id", params: { id: leadId } })
              }
              className="flex shrink-0 items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to profile
            </button>
            <span className="text-white/20">|</span>
            <span className="truncate text-sm font-medium text-white/80">
              Feasibility Call
              {lead?.fullName && (
                <span className="text-white/40"> · {lead.fullName}</span>
              )}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Draft picker */}
            <div className="relative">
              <button
                onClick={() => setShowDraftList((p) => !p)}
                className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs text-white/65 transition-colors hover:bg-white/15 hover:text-white"
              >
                <FileText className="h-3 w-3" />
                {allDrafts.length > 1
                  ? `${allDrafts.length} calls`
                  : "This call"}
                <ChevronDown className="h-3 w-3" />
              </button>

              {showDraftList && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-52 overflow-hidden rounded-lg border border-border bg-card shadow-elevated">
                  {allDrafts.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setDraft(d);
                        setShowDraftList(false);
                        setOutputReady(false);
                      }}
                      className={cn(
                        "flex w-full flex-col items-start border-b border-border px-3 py-2 text-left text-xs transition-colors last:border-0 hover:bg-accent",
                        d.id === draft.id && "bg-accent",
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {formatDraftLabel(d)}
                      </span>
                      <span className="text-muted-foreground">
                        Step {d.currentStep} of 3 ·{" "}
                        {d.components.filter((c) => c.headerName || c.name)
                          .length}{" "}
                        component
                        {d.components.filter((c) => c.headerName || c.name)
                          .length !== 1
                          ? "s"
                          : ""}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={startNewCall}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-cyan transition-colors hover:bg-accent"
                  >
                    <Plus className="h-3 w-3" />
                    New call
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs text-white/65 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Printer className="h-3 w-3" />
              Export
            </button>

            <button
              onClick={() => goTo(3)}
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
              { n: 2, label: "BCM v1 Builder" },
              { n: 3, label: "Feasibility Output" },
            ] as const
          ).map(({ n, label }) => (
            <button
              key={n}
              onClick={() => goTo(n)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3 text-xs font-medium transition-colors",
                step === n
                  ? "border-cyan text-cyan"
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
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
        {step === 1 && (
          <CallSetupStep
            setup={draft.setup}
            onUpdate={patchSetup}
            onNext={() => goTo(2)}
          />
        )}
        {step === 2 && (
          <BCMBuilderStep
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
          />
        )}
      </div>
    </div>
  );
}

// ── Step 1: Call Setup ────────────────────────────────────────────────────────

function CallSetupStep({
  setup,
  onUpdate,
  onNext,
}: {
  setup: FCSetup;
  onUpdate: (field: keyof FCSetup, value: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Call Setup
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture context before the call. This is{" "}
            <em>not</em> a technical intake.
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
            <Input
              placeholder="2023"
              value={setup.taxYear}
              onChange={(e) => onUpdate("taxYear", e.target.value)}
            />
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
          <MF label="Tax Preparer / CPA">
            <Input
              placeholder="Firm or person name"
              value={setup.taxPreparer}
              onChange={(e) => onUpdate("taxPreparer", e.target.value)}
            />
          </MF>
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
        <Button onClick={onNext} className="gap-2">
          Build BCM v1 <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: BCM v1 Builder ────────────────────────────────────────────────────

function BCMBuilderStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            BCM v1 Builder
          </h1>
        </div>
        <StepTag>Step 2 of 3</StepTag>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-2">
          Generate Output <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Feasibility Output ────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  possible: "Possible",
  strong: "Strong",
  clarify: "Needs Clarification",
};
const STATUS_CLS: Record<string, string> = {
  possible: "bg-green/10 text-green",
  strong: "bg-primary/10 text-primary",
  clarify: "bg-orange/10 text-orange-foreground",
};

function FeasibilityOutputStep({
  draft,
  outputReady,
  generating,
  onGenerate,
  onBack,
}: {
  draft: FeasibilityCallDraft;
  outputReady: boolean;
  generating: boolean;
  onGenerate: () => void;
  onBack: () => void;
}) {
  const { setup, components } = draft;
  const allEntities = [...new Set(components.flatMap((c) => c.entities))];
  const namedComponents = components.filter(
    (c) => (c.name || c.headerName).trim(),
  );

  const docName = setup.doctorName || "the physician";
  const practice = setup.practiceName || "their practice";
  const taxYear = setup.taxYear || "the tax year";
  const rep = setup.salesRep || "the sales representative";
  const pType = (setup.practiceType || "medical practice").toLowerCase();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Feasibility Output
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and share with your team and tax preparer.
          </p>
        </div>
        <StepTag>Step 3 of 3</StepTag>
      </div>

      <Button
        onClick={onGenerate}
        disabled={generating}
        className="mb-6 gap-2"
      >
        {generating ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
            Building…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {outputReady ? "Regenerate" : "Generate Analysis"}
          </>
        )}
      </Button>

      {!outputReady && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
          <Sparkles className="mb-3 h-9 w-9 text-muted-foreground/25" />
          <p className="text-sm text-muted-foreground">
            Click &ldquo;Generate Analysis&rdquo; to compile your feasibility
            output from the BCM v1 data.
          </p>
        </div>
      )}

      {outputReady && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Entity map */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-lg font-bold text-foreground">
              Entity Map
            </h2>
            {allEntities.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No entities assigned yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {allEntities.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-2.5 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-cyan" />
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Preparer-Ready Summary */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-lg font-bold text-foreground">
              Preparer-Ready Summary
            </h2>
            <div className="space-y-2.5 text-sm leading-relaxed text-foreground">
              <p>
                The following summary was prepared following a feasibility call
                with <strong>{docName}</strong> of{" "}
                <strong>{practice}</strong>, conducted by {rep}
                {setup.callDate ? ` on ${setup.callDate}` : ""}, for tax year{" "}
                <strong>{taxYear}</strong>.
              </p>
              <p>
                This is a {pType} practice
                {setup.numLocations
                  ? ` operating across ${setup.numLocations} location(s)`
                  : ""}
                {setup.numEmployees
                  ? ` with approximately ${setup.numEmployees} employees`
                  : ""}
                . The discovery conversation surfaced indicators of qualifying
                R&D activity during the evaluation period.
              </p>
              {namedComponents.length > 0 && (
                <p>
                  A total of{" "}
                  <strong>{namedComponents.length} business component(s)</strong>{" "}
                  were identified during this call and are detailed in the BCM
                  v1 below. These components represent initial areas of
                  potential qualification and should be validated by the
                  Discovery team.
                </p>
              )}
              <p>
                A technical intake with the Discovery department is recommended
                as the next step to validate, quantify, and document qualifying
                activities. The BCM v1 components above serve as the initial
                brief for that handoff.
              </p>
            </div>
          </div>

          {/* BCM Summary — full width */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:col-span-2">
            <h2 className="mb-4 text-lg font-bold text-foreground">
              BCM v1 — Component Summary
            </h2>
            {namedComponents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No business components defined yet.
              </p>
            ) : (
              <div className="space-y-3">
                {namedComponents.map((comp) => {
                  const name = (comp.name || comp.headerName).trim();
                  const qs = comp.qualificationStatus;
                  return (
                    <div
                      key={comp.id}
                      className="rounded-lg border border-border bg-background p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-foreground">
                          {name}
                        </strong>
                        {qs && (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                              STATUS_CLS[qs],
                            )}
                          >
                            {STATUS_LABEL[qs]}
                          </span>
                        )}
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
                            {comp.entities.join(", ")}
                          </OutField>
                        )}
                        {comp.mainContact && (
                          <OutField label="Main Contact">
                            {comp.mainContact}
                          </OutField>
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

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to BCM
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print / Export
        </Button>
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

function MF({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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
