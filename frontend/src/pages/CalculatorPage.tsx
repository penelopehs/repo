// Calculator page — multi-year client setup, eligibility-aware entities, billing dashboard.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2, Layers, Calculator as CalcIcon, DollarSign, FileDown, Share2, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/KpiCard";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { EntityCard } from "@/components/calculator/EntityCard";
import { BillingTable, computeBilled } from "@/components/calculator/BillingTable";
import { useCalculatorStore } from "@/store/calculatorStore";
import { FILING_STATUSES } from "@/types/crm";

export function CalculatorPage() {
  const {
    client, setClientField, toggleTaxYear, selectAllTaxYears, clearTaxYears,
    entityCountInput, setEntityCountInput,
    entities, generateEntities, addEntity,
    notes, setNotes,
  } = useCalculatorStore();

  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const filingRate = FILING_STATUSES.find((f) => f.value === client.filingStatus)?.rate ?? 0.21;

  const totals = useMemo(() => {
    const billed = computeBilled(entities, filingRate);
    return billed.reduce(
      (a, r) => ({ sow: a.sow + r.sow, fed: a.fed + r.fed, total: a.total + r.total }),
      { sow: 0, fed: 0, total: 0 },
    );
  }, [entities, filingRate]);

  // Honor ?clientName=... from "New Calculation" deep links.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const name = q.get("clientName");
    if (name && !client.clientName) setClientField("clientName", name);
  }, [client.clientName, setClientField]);

  const yearsLabel = client.taxYears.length === 7
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
      document.getElementById("entity-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the client, generate entities, and produce a billing-ready summary.
        </p>
      </div>

      {/* Section 1 — Client Information */}
      <Section icon={<Building2 className="h-4 w-4 text-cyan" />} title="Client Information">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Client Name</Label>
            <Input
              value={client.clientName}
              onChange={(e) => setClientField("clientName", e.target.value)}
              placeholder="e.g. Helios Biotech LLC"
              maxLength={160}
            />
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              type="number" min={1} max={50}
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
            Enter the total number of entities for this client, then click Generate to create input cards.
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
      <Section title="Billing Overview Summary" icon={<DollarSign className="h-4 w-4 text-green" />}>
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-gradient-frost p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Overview</p>
            <h3 className="mt-1 text-xl font-bold text-navy">
              {client.clientName || "Untitled Client"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-navy">{yearsLabel}</span>
              <span className="mx-2 opacity-50">·</span>
              <span>{entities.length} {entities.length === 1 ? "entity" : "entities"}</span>
            </p>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <KpiCard label="Total Entities" value={entities.length} icon={Layers} accent="navy" />
            <KpiCard label="Total SOW"      value={totals.sow}      icon={DollarSign} accent="orange" currency />
            <KpiCard label="Federal Total"  value={totals.fed}      icon={CalcIcon}   accent="cyan" currency />
            <KpiCard label="Grand Total"    value={totals.total}    icon={DollarSign} accent="green" currency />
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
  id, icon, title, subtitle, action, children,
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
