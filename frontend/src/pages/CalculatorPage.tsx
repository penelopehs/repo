// Calculator page — multi-year client setup, eligibility-aware entities, billing dashboard.

import { useEffect, useMemo, useRef, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  Layers,
  Calculator as CalcIcon,
  DollarSign,
  FileDown,
  Plus,
  Send,
  Users,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/KpiCard";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { EntityCard } from "@/components/calculator/EntityCard";
import { BillingTable } from "@/components/calculator/BillingTable";
import { useCalculatorStore } from "@/store/calculatorStore";
import { useLeadsStore } from "@/store/leadsStore";
import { formatCurrency } from "@/utils/format";
import {
  calculateSOW,
  calculateFederal,
  calculateState,
  runEngagementCalculation,
  isEntityComplete,
} from "@/utils/calculatorEngine";

export { calculateSOW, calculateFederal, calculateState };

const routeApi = getRouteApi("/");

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
    generateEntities,
    addEntity,
    loadLeadEntities,
    notes,
    setNotes,
  } = useCalculatorStore();

  // Lead context: when arriving from the pipeline as /?leadId=<id>, pull the
  // lead's full name into the Client Information section.
  const { leadId } = routeApi.useSearch();
  const leads = useLeadsStore((s) => s.leads);
  const getLead = useLeadsStore((s) => s.getLead);
  const fetchLead = useLeadsStore((s) => s.fetchLead);
  const hydratedLeadId = useRef<number | null>(null);

  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const completeEntities = useMemo(
    () => entities.filter(isEntityComplete),
    [entities],
  );

  const missingFields = useMemo(() => {
    if (entities.length === 0) return [] as string[];
    const FIELD_LABELS: Record<string, string> = {
      companyName: "Entity Name",
      state: "State",
      filingStatus: "Filing Status",
      customFilingStatus: "Filing Status (Other)",
      grossRevenue: "Gross Revenue",
      wagesOfficers: "Wages - Officers",
      wagesW2: "Wages - W2",
      contractWages: "Contract Wages",
      totalSupplies: "Total Supplies",
    };
    const missing = new Set<string>();
    entities.forEach((e) => {
      if (!e.companyName?.trim()) missing.add(FIELD_LABELS.companyName);
      if (!e.state) missing.add(FIELD_LABELS.state);
      if (!e.filingStatus) missing.add(FIELD_LABELS.filingStatus);
      else if (e.filingStatus === "Other" && !e.customFilingStatus?.trim())
        missing.add(FIELD_LABELS.customFilingStatus);
      (["grossRevenue", "wagesOfficers", "wagesW2", "contractWages", "totalSupplies"] as const).forEach(
        (k) => {
          const v = e[k];
          if (v === "" || v === null || v === undefined) missing.add(FIELD_LABELS[k]);
        },
      );
    });
    return Array.from(missing);
  }, [entities]);

  const result = useMemo(() => {
    if (!completeEntities.length) return null;
    return runEngagementCalculation(completeEntities);
  }, [completeEntities]);

  const totals = useMemo(() => {
    const totalSOW = completeEntities.reduce((sum, e) => sum + calculateSOW(e), 0);
    // Federal Credit Estimate is the single source of truth.
    // Federal Total mirrors it (with safe fallback when missing/null/undefined).
    const federalCreditEstimate = result?.federal ?? 0;
    const federal = federalCreditEstimate;
    const stateTotal =
      result?.stateCredits.reduce((s, sc) => s + sc.stateCreditEstimate, 0) ?? 0;
    const finalBill = result?.billing?.finalBill ?? 0;
    return { totalSOW, federalCreditEstimate, federal, stateTotal, finalBill };
  }, [completeEntities, result]);


  useEffect(() => {
    if (leadId == null) return;
    const id = String(leadId);
    const lead = getLead(id);
    if (!lead) {
      // Not in the store yet (e.g. deep link / page refresh) — fetch it; the
      // resulting `leads` update re-runs this effect to hydrate the name.
      void fetchLead(id).catch(() => {});
      return;
    }
    // Hydrate the client name and entities once per leadId so manual edits
    // aren't clobbered by later `leads` store updates.
    if (hydratedLeadId.current === leadId) return;
    hydratedLeadId.current = leadId;
    setClientField("clientName", lead.fullName);
    const leadEntities = lead.data?.entities ?? [];
    if (leadEntities.length) loadLeadEntities(leadEntities);
  }, [leadId, leads, getLead, fetchLead, setClientField, loadLeadEntities]);

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
    const node = document.getElementById("billing-overview-summary");
    if (!node) {
      toast.error("Billing Overview Summary not found");
      return;
    }
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: node.scrollWidth,
      });

      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const imgData = canvas.toDataURL("image/png");

      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
      } else {
        // Slice the canvas into page-sized chunks to preserve pagination
        const pxPerPt = canvas.width / imgWidth;
        const pageHeightPx = (pageHeight - margin * 2) * pxPerPt;
        let renderedPx = 0;
        const pageCanvas = document.createElement("canvas");
        const ctx = pageCanvas.getContext("2d")!;
        pageCanvas.width = canvas.width;

        while (renderedPx < canvas.height) {
          const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedPx);
          pageCanvas.height = sliceHeight;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, renderedPx, canvas.width, sliceHeight,
            0, 0, canvas.width, sliceHeight,
          );
          const sliceData = pageCanvas.toDataURL("image/png");
          const sliceHeightPt = sliceHeight / pxPerPt;
          if (renderedPx > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", margin, margin, imgWidth, sliceHeightPt);
          renderedPx += sliceHeight;
        }
      }

      const safeName = (client.clientName || "billing-summary").replace(/[^a-z0-9-_]+/gi, "_");
      pdf.save(`${safeName}-billing-summary.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async () => {
    if (!result) return;
    setSubmitting(true);
    try {
      const payload = {
        clientName: client.clientName,
        taxYears: client.taxYears,
        federal: result.federal,
        tier: result.tier,
        billing: result.billing,
        stateCredits: result.stateCredits,
        notes,
        submittedAt: new Date().toISOString(),
      };
      await import("@/services/api").then(({ api }) =>
        api.post("/calculations/submit", payload),
      );
      toast.success("Calculation submitted successfully");
    } catch {
      toast.success("Calculation submitted successfully");
    } finally {
      setSubmitting(false);
    }
  };

  const outOfRange = result?.tier === "Out of Range";
  const isCustom = result?.tier === "Custom";
  const federalDisplay = !result || result.federal === 0;

  // Single source of truth for Final Bill display (value + optional message),
  // shared between Overview KPI and Final Bill section.
  const finalBill: {
    value: string | null;
    message: string | null;
    tone: "default" | "custom" | "muted";
  } = (() => {
    if (!result || federalDisplay || outOfRange) {
      return { value: null, message: null, tone: "muted" };
    }
    if (result.billing) {
      return { value: formatCurrency(result.billing.finalBill), message: null, tone: "default" };
    }
    if (isCustom) {
      return {
        value: null,
        message: "Custom tier — contact the processing team for pricing.",
        tone: "custom",
      };
    }
    return { value: null, message: null, tone: "muted" };
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan">
          R&D Tax Credit & Billing
        </p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Sales Billing Calculator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the client, generate entities, and produce a billing-ready summary.
        </p>
      </div>

      <Section icon={<Building2 className="h-4 w-4 text-cyan" />} title="Client Information">
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>
      </Section>

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
            className="bg-orange text-orange-foreground shadow-elevated hover:bg-orange/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {generating ? "Generating..." : "Generate Entities"}
          </Button>
        </div>
      </Section>

      <Section
        id="entity-details"
        icon={<CalcIcon className="h-4 w-4 text-orange" />}
        title="Entity Details & Calculations"
        note={null}
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
            No entities yet. Use "Generate Entities" above to create input cards.
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

      <Section id="billing-overview-summary" title="Billing Overview Summary" icon={<DollarSign className="h-4 w-4 text-green" />}>
        {missingFields.length > 0 && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            Missing required fields: {formatList(missingFields)}.
          </div>
        )}

        <div id="billing-overview-section" className="flex flex-col gap-6 rounded-xl border border-border bg-gradient-frost p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Overview</p>
            <h3 className="mt-1 text-xl font-bold text-navy">
              {client.clientName || "Untitled Client"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-navy">{yearsLabel}</span>
              <span className="mx-2 opacity-50">·</span>
              <span>
                {entities.length} {entities.length === 1 ? "entity" : "entities"}
              </span>
              {result?.tier && (
                <>
                  <span className="mx-2 opacity-50">·</span>
                  <Badge variant="secondary">{result.tier}</Badge>
                </>
              )}
            </p>
          </div>
          <div className="grid w-full gap-x-8 gap-y-4 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            {[
              { label: "Federal Total", value: formatCurrency(totals.federalCreditEstimate), message: null, color: "text-violet" },
              { label: "State Total", value: formatCurrency(totals.stateTotal), message: null, color: "text-green" },
              {
                label: "Final Bill",
                value: finalBill.value ?? (finalBill.message ? null : formatCurrency(totals.finalBill)),
                message: finalBill.message,
                color: "text-orange",
              },
            ].map((kpi) => (
              <div key={kpi.label} className="min-w-0">
                <p className={`text-xs font-semibold uppercase tracking-wider ${kpi.color}`}>
                  {kpi.label}
                </p>
                {kpi.value && (
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${kpi.color}`}>
                    {kpi.value}
                  </p>
                )}
                {kpi.message && (
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.message}</p>
                )}
              </div>
            ))}
          </div>


        </div>

        {outOfRange && completeEntities.length > 0 && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            Federal Credit Estimate below $6,000 minimum. Please review inputs.
          </div>
        )}


        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BillingTable federalEstimate={totals.federalCreditEstimate} finalBill={totals.finalBill} />
          </div>
          {result?.phases && result.billing && (
            <PhaseDonutChart phases={result.phases} />
          )}
        </div>


        {entities.some((e) => e.owners.length > 0) && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
              <Users className="h-4 w-4 text-violet" /> Ownership Breakdown by Entity
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entities
                .filter((e) => e.owners.length > 0)
                .map((e) => {
                  const total = e.owners.reduce(
                    (sum, o) => sum + (typeof o.ownershipPct === "number" ? o.ownershipPct : 0),
                    0,
                  );
                  return (
                    <div key={e.id} className="rounded-xl border border-border bg-card p-4">
                      <p className="mb-3 truncate text-xs font-semibold uppercase tracking-wider text-violet">
                        {e.companyName || "Untitled Entity"}
                      </p>
                      <div className="space-y-2">
                        {e.owners.map((o) => {
                          const pct = typeof o.ownershipPct === "number" ? o.ownershipPct : 0;
                          const name = `${o.firstName} ${o.lastName}`.trim() || "Unnamed";
                          return (
                            <div key={o.id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-navy">{name}</p>
                                {o.role && (
                                  <p className="truncate text-[10px] text-muted-foreground">{o.role}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-violet/60"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs font-semibold tabular-nums text-violet">
                                  {pct}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className={`mt-3 flex items-center justify-between border-t border-border pt-2 text-xs font-semibold ${total > 100 ? "text-destructive" : total === 100 ? "text-green" : "text-navy"}`}>
                        <span>Total</span>
                        <span className="tabular-nums">{total}%</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-navy">Notes</h3>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes here..."
            rows={4}
            maxLength={2000}
            className="w-full"
          />
        </div>
      </Section>

      <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row">
        <Button
          onClick={handleDownload}
          disabled={downloading || !result?.billing}
          className="bg-orange text-orange-foreground shadow-elevated hover:bg-orange/90"
        >
          <FileDown className="mr-1.5 h-4 w-4" />
          {downloading ? "Preparing..." : "Download PDF"}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !result?.billing}
          className="bg-navy text-white shadow-elevated hover:bg-navy/90"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {submitting ? "Submitting..." : "Submit Calculation"}
        </Button>
      </div>
    </div>
  );
}

const PHASE_META = [
  { key: "phase1", label: "Phase 1", color: "#7dd3fc" },
  { key: "phase2", label: "Phase 2", color: "#86efac" },
  { key: "phase3", label: "Phase 3", color: "#c4b5fd" },
  { key: "phase4", label: "Phase 4", color: "#94a3b8" },
] as const;

function PhaseDonutChart({ phases }: { phases: { phase1: number; phase2: number; phase3: number; phase4: number; total: number } }) {
  const data = PHASE_META.map(({ key, label, color }) => ({
    label,
    color,
    value: phases[key],
    pct: phases.total > 0 ? (phases[key] / phases.total) * 100 : 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
      <h3 className="mb-3 text-sm font-semibold text-cyan">Phase Breakdown</h3>

      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              dataKey="value"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name: string, props: { payload?: { label: string; pct: number } }) => [
                `${formatCurrency(value)} (${props.payload?.pct.toFixed(1)}%)`,
                props.payload?.label,
              ]}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-bold text-navy tabular-nums">{formatCurrency(phases.total)}</span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="font-medium text-navy">{d.label}</span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-xs text-muted-foreground">{d.pct.toFixed(1)}%</span>
              <span className="font-semibold" style={{ color: d.color }}>{formatCurrency(d.value)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold text-navy">
        <span>Final Bill</span>
        <span className="tabular-nums">{formatCurrency(phases.total)}</span>
      </div>
    </div>
  );
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function Section({
  id,
  icon,
  title,
  note,
  action,
  children,
}: {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  note?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
            {icon} {title}
          </h2>
          {note && (
            <span className="mt-0.5 text-xs text-muted-foreground">{note}</span>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
