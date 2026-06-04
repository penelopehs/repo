// Calculator page — multi-year client setup, eligibility-aware entities, billing dashboard.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  Layers,
  Calculator as CalcIcon,
  DollarSign,
  FileDown,
  Share2,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/KpiCard";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { EntityCard } from "@/components/calculator/EntityCard";
import { BillingTable, computeBilled } from "@/components/calculator/BillingTable";
import { useCalculatorStore } from "@/store/calculatorStore";
import {
  FILING_STATUSES,
  type Entity,
  type FilingStatus,
  type Lead,
  type LeadData,
  type LeadDataEntity,
  type TaxYear,
} from "@/types/crm";
import { leadsApi } from "@/services/leads";
import { cn } from "@/lib/utils";

// ── Entity ↔ LeadDataEntity mapping ─────────────────────────────────────────

function toLeadEntity(e: Entity): LeadDataEntity {
  return {
    name: e.companyName,
    ...(e.state && { state: e.state }),
    ...(e.employeeCount !== "" && { employeeCount: e.employeeCount }),
    ...(e.estimatedQRAs !== "" && { estimatedQRAs: e.estimatedQRAs }),
    ...(e.grossCredit !== "" && { grossCredit: e.grossCredit }),
    ...(e.w2Wages !== "" && { w2Wages: e.w2Wages }),
    ...(e.contractResearch !== "" && { contractResearch: e.contractResearch }),
    ...(e.supplies !== "" && { supplies: e.supplies }),
    ...(e.otherQualified !== "" && { otherQualified: e.otherQualified }),
    ...(e.notes && { notes: e.notes }),
  };
}

function fromLeadEntity(e: LeadDataEntity, index: number): Entity {
  return {
    id: `ent_lead_${index}_${Math.random().toString(36).slice(2, 7)}`,
    companyName: e.name ?? "",
    state: e.state ?? "",
    employeeCount: e.employeeCount ?? "",
    estimatedQRAs: e.estimatedQRAs ?? "",
    grossCredit: e.grossCredit ?? "",
    w2Wages: e.w2Wages ?? "",
    contractResearch: e.contractResearch ?? "",
    supplies: e.supplies ?? "",
    otherQualified: e.otherQualified ?? "",
    notes: e.notes ?? "",
  };
}

// Normalised string key for change-detection (excludes transient `id`).
function entityKey(e: LeadDataEntity): string {
  return JSON.stringify({
    name: e.name ?? "",
    state: e.state ?? "",
    employeeCount: e.employeeCount ?? "",
    estimatedQRAs: e.estimatedQRAs ?? "",
    grossCredit: e.grossCredit ?? "",
    w2Wages: e.w2Wages ?? "",
    contractResearch: e.contractResearch ?? "",
    supplies: e.supplies ?? "",
    otherQualified: e.otherQualified ?? "",
    notes: e.notes ?? "",
  });
}

export function CalculatorPage() {
  const {
    client,
    setClientField,
    toggleTaxYear,
    selectAllTaxYears,
    clearTaxYears,
    entityCountInput,
    setEntityCountInput,
    entities,
    setEntities,
    generateEntities,
    addEntity,
    notes,
    setNotes,
  } = useCalculatorStore();

  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all leads once on mount for client name autocomplete
  useEffect(() => {
    leadsApi.list().then(setAllLeads).catch(() => {});
  }, []);

  const suggestions = allLeads.filter((l) =>
    l.fullName.toLowerCase().includes(client.clientName.toLowerCase()),
  );

  // Debounced save whenever taxYears, filingStatus, or entities change after a lead is selected.
  // Guard compares current state against selectedLead so hydration doesn't trigger a spurious save.
  useEffect(() => {
    if (!selectedLead) return;

    const base: LeadData = selectedLead.data ?? { people: [], entities: [], calculations: {} };
    const leadFilingStatus: FilingStatus = base.filingStatus ?? "mfj";
    const unchanged =
      JSON.stringify(client.taxYears) === JSON.stringify(selectedLead.taxYears) &&
      client.filingStatus === leadFilingStatus &&
      (base.entities ?? []).map(entityKey).join("|") === entities.map(toLeadEntity).map(entityKey).join("|");

    if (unchanged) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const oldCalcs = base.calculations ?? {};
      const newCalcs: Record<string, Record<string, unknown>> = {};
      for (const y of client.taxYears) {
        newCalcs[String(y)] = (oldCalcs[String(y)] as Record<string, unknown>) ?? {};
      }
      const updatedData: LeadData = {
        ...base,
        calculations: newCalcs,
        filingStatus: client.filingStatus,
        entities: entities.map(toLeadEntity),
      };
      leadsApi.update(selectedLead.id, { data: updatedData }).catch(() => {});
      setSelectedLead((prev) =>
        prev ? { ...prev, taxYears: [...client.taxYears], data: updatedData } : null,
      );
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [client.taxYears, client.filingStatus, entities, selectedLead]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filingRate = FILING_STATUSES.find((f) => f.value === client.filingStatus)?.rate ?? 0.21;

  const totals = useMemo(() => {
    const billed = computeBilled(entities, filingRate);
    return billed.reduce(
      (a, r) => ({ sow: a.sow + r.sow, fed: a.fed + r.fed, total: a.total + r.total }),
      { sow: 0, fed: 0, total: 0 },
    );
  }, [entities, filingRate]);

  // Honor calculation deep links from the dashboard so the calculator opens with client + year context.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const name = q.get("clientName");
    const years = q.get("taxYears");

    if (name && !client.clientName) setClientField("clientName", name);

    if (years) {
      const parsed = years
        .split(",")
        .map((value) => Number(value))
        .filter(
          (value): value is TaxYear => Number.isInteger(value) && value >= 2020 && value <= 2026,
        )
        .sort((a, b) => a - b);

      if (parsed.length > 0 && JSON.stringify(parsed) !== JSON.stringify(client.taxYears)) {
        setClientField("taxYears", parsed);
      }
    }
  }, [client.clientName, client.taxYears, setClientField]);

  const hasExistingCalculationContext =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("hasExistingCalculation") === "true";
  const latestCalculationLabel =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("latestCalculation")
      : null;
  const calculationContextMessage =
    hasExistingCalculationContext && latestCalculationLabel && latestCalculationLabel !== "—"
      ? `Existing calculation(s) found for ${client.clientName || "this client"}. Latest saved calculation: ${latestCalculationLabel}.`
      : `No saved calculation found yet. Generate a fresh calculation for ${client.taxYears.length ? client.taxYears.join(", ") : "the selected tax years"}.`;

  const yearsLabel =
    client.taxYears.length === 7
      ? "All Tax Years"
      : client.taxYears.length === 0
        ? "No years selected"
        : client.taxYears.join(", ");

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 350));
    generateEntities(entityCountInput);
    setGenerating(false);
    setTimeout(() => {
      document
        .getElementById("entity-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleDownload = async () => {
    setDownloading(true);
    await new Promise((r) => setTimeout(r, 900));
    setDownloading(false);
    toast.success("ODF generated", { description: "Billing summary ready for download." });
  };

  const handleShare = async () => {
    setSharing(true);
    await new Promise((r) => setTimeout(r, 900));
    setSharing(false);
    toast.success("Prepared for SharePoint", { description: "Package staged for upload." });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Calculator</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Client Setup</h1>
        <div
          className={cn(
            "mt-3 rounded-xl border px-4 py-3 text-sm",
            hasExistingCalculationContext
              ? "border-cyan/40 bg-cyan/8 text-cyan-foreground"
              : "border-amber-200 bg-amber-50 text-amber-950",
          )}
        >
          {calculationContextMessage}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the client, generate entities, and produce a billing-ready summary.
        </p>
      </div>

      {/* Section 1 — Client Information */}
      <Section icon={<Building2 className="h-4 w-4 text-cyan" />} title="Client Information">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative" ref={suggestionRef}>
            <Label>Client Name</Label>
            <Input
              value={client.clientName}
              onChange={(e) => {
                setClientField("clientName", e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. Helios Biotech LLC"
              maxLength={160}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
                {suggestions.map((lead) => (
                  <li
                    key={lead.id}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const leadEntities = lead.data?.entities ?? [];
                      setSelectedLead(lead);
                      setClientField("clientName", lead.fullName);
                      setClientField("taxYears", lead.taxYears);
                      setClientField("filingStatus", lead.data?.filingStatus ?? "mfj");
                      setEntities(leadEntities.map(fromLeadEntity));
                      setEntityCountInput(Math.max(1, leadEntities.length));
                      setShowSuggestions(false);
                    }}
                  >
                    {lead.fullName}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <Label>Tax Year(s)</Label>
            <MultiYearSelect
              value={client.taxYears}
              onToggle={toggleTaxYear}
              onSelectAll={selectAllTaxYears}
              onClear={clearTaxYears}
            />
          </div>
          <div>
            <Label>Filing Status</Label>
            <Select
              value={client.filingStatus}
              onValueChange={(v) => setClientField("filingStatus", v as typeof client.filingStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILING_STATUSES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label} ({Math.round(f.rate * 100)}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* Section 2 — Generate Entities */}
      <Section icon={<Layers className="h-4 w-4 text-violet" />} title="Generate Entities">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-48">
            <Label>Number of Entities</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={entityCountInput}
              onChange={(e) => setEntityCountInput(Number(e.target.value) || 1)}
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {generating ? "Generating..." : "Generate Entities"}
          </Button>
          <p className="text-xs text-muted-foreground md:ml-3">
            Enter the total number of entities for this client, then click Generate to create input
            cards.
          </p>
        </div>
      </Section>

      {/* Section 3 — Entity Details */}
      <Section
        id="entity-details"
        icon={<CalcIcon className="h-4 w-4 text-orange" />}
        title="Entity Details & Calculations"
        subtitle="Fill in the highlighted fields for each entity."
        action={
          entities.length > 0 && (
            <Button variant="outline" onClick={addEntity}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Entity
            </Button>
          )
        }
      >
        {entities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
            No entities yet. Use “Generate Entities” above to create input cards.
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {entities.map((e, i) => (
                <EntityCard key={e.id} entity={e} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </Section>

      {/* Section 4 — Billing Overview Summary (unified container) */}
      <Section
        title="Billing Overview Summary"
        icon={<DollarSign className="h-4 w-4 text-green" />}
      >
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-gradient-frost p-4 lg:flex-row lg:items-start lg:justify-between lg:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan">
              Overview
            </p>
            <h3 className="mt-1 text-lg font-bold text-navy lg:text-xl">
              {client.clientName || "Untitled Client"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-navy">{yearsLabel}</span>
              <span className="mx-2 opacity-50">·</span>
              <span>
                {entities.length} {entities.length === 1 ? "entity" : "entities"}
              </span>
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <KpiCard
              compact
              label="Total Entities"
              value={entities.length}
              icon={Layers}
              accent="navy"
            />
            <KpiCard
              compact
              label="Total SOW"
              value={totals.sow}
              icon={DollarSign}
              accent="orange"
              currency
            />
            <KpiCard
              compact
              label="Federal Total"
              value={totals.fed}
              icon={CalcIcon}
              accent="cyan"
              currency
            />
            <KpiCard
              compact
              label="Grand Total"
              value={totals.total}
              icon={DollarSign}
              accent="green"
              currency
            />
          </div>
        </div>

        <div className="mt-6">
          <BillingTable />
        </div>
      </Section>

      {/* Notes */}
      <Section title="Processing Team Notes">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add internal processing notes here..."
          rows={4}
          maxLength={2000}
        />
      </Section>

      {/* Actions */}
      <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row">
        <Button
          variant="outline"
          onClick={handleShare}
          disabled={sharing}
          className="border-cyan text-cyan hover:bg-cyan/10"
        >
          <Share2 className="mr-1.5 h-4 w-4" />
          {sharing ? "Preparing..." : "Prepare for SharePoint"}
        </Button>
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated"
        >
          <FileDown className="mr-1.5 h-4 w-4" />
          {downloading ? "Generating ODF..." : "Download ODF"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
            {icon} {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
