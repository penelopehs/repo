// Client Pipeline — three sections + KPI-driven filtering, search, and sortable table.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Users, FileText, ScrollText, Briefcase, Layers, Search, ArrowUp, ArrowDown, ArrowUpDown,
  Eye, Calculator, FileSignature, Pencil, Trash2, MoreHorizontal, PlayCircle, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/pipeline/StatusBadge";
import { AddLeadDialog } from "@/components/pipeline/AddLeadDialog";
import { EditClientDialog } from "@/components/pipeline/EditClientDialog";
import { YearChips } from "@/components/MultiYearSelect";
import { useLeadsStore } from "@/store/leadsStore";
import type { Lead, LeadStatus } from "@/types/crm";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

type KpiFilter = "total" | "new" | "active" | "calc" | "sow" | null;
type SortField = "status" | "rep" | "entities" | "latest" | "added" | "years";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const KPI_TO_STATUS: Record<Exclude<KpiFilter, "total" | null>, LeadStatus> = {
  new: "new",
  active: "active_engagement",
  calc: "calculation_sent",
  sow: "sow_signed",
};

export function PipelinePage() {
  const leads = useLeadsStore((s) => s.leads);
  const deleteLead = useLeadsStore((s) => s.deleteLead);
  const setStatus = useLeadsStore((s) => s.setStatus);
  const promote = useLeadsStore((s) => s.promoteToActive);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [sortField, setSortField] = useState<SortField>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);

  const kpis = useMemo(() => ({
    total: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    active: leads.filter((l) => l.status === "active_engagement").length,
    calcSent: leads.filter((l) => l.status === "calculation_sent").length,
    sowSigned: leads.filter((l) => l.status === "sow_signed").length,
  }), [leads]);

  const active = useMemo(() => leads.filter((l) => l.status === "active_engagement"), [leads]);
  const sowReady = useMemo(() => leads.filter((l) => l.status === "sow_signed"), [leads]);

  const isFiltered = !!kpiFilter || query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = leads.filter((l) => {
      const matchQ = !q ||
        l.fullName.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q);
      const matchK = !kpiFilter || kpiFilter === "total" || l.status === KPI_TO_STATUS[kpiFilter];
      return matchQ && matchK;
    });
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "status":   return a.status.localeCompare(b.status) * dir;
        case "rep":      return a.rep.localeCompare(b.rep) * dir;
        case "entities": return (a.entitiesCount - b.entitiesCount) * dir;
        case "latest":   return a.latestCalculation.localeCompare(b.latestCalculation) * dir;
        case "added":    return (new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()) * dir;
        case "years":    return (a.taxYears.length - b.taxYears.length) * dir;
      }
    });
    return rows;
  }, [leads, query, kpiFilter, sortField, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goCalc = (l: Lead) => {
    navigate({ to: "/", search: { clientName: l.company } as never });
  };
  const goProfile = (l: Lead) => navigate({ to: "/clients/$id", params: { id: l.id } });

  const onSort = (f: SortField) => {
    if (f === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("asc"); }
  };

  const clearAll = () => {
    setKpiFilter(null);
    setQuery("");
    setPage(1);
  };

  const onKpiClick = (f: Exclude<KpiFilter, null>) => {
    setKpiFilter((cur) => (cur === f ? null : f));
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Client Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage leads, send proposals, and track active engagements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by entity or client name..."
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={clearAll}
            disabled={!isFiltered}
            className="border-cyan text-cyan hover:bg-cyan/10"
          >
            <X className="mr-1.5 h-4 w-4" /> Clear Filter
          </Button>
          <AddLeadDialog />
        </div>
      </div>

      {/* Clickable KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiButton active={kpiFilter === "total"}  onClick={() => onKpiClick("total")}><KpiCard label="Total"              value={kpis.total}     icon={Layers}    accent="navy"   labelClassName="text-[#00264A]" /></KpiButton>
        <KpiButton active={kpiFilter === "new"}    onClick={() => onKpiClick("new")}><KpiCard label="New"                value={kpis.new}       icon={Users}     accent="cyan"   /></KpiButton>
        <KpiButton active={kpiFilter === "active"} onClick={() => onKpiClick("active")}><KpiCard label="Active"             value={kpis.active}    icon={Briefcase} accent="green"  /></KpiButton>
        <KpiButton active={kpiFilter === "calc"}   onClick={() => onKpiClick("calc")}><KpiCard label="Calculations Sent"  value={kpis.calcSent}  icon={FileText}  accent="orange" /></KpiButton>
        <KpiButton active={kpiFilter === "sow"}    onClick={() => onKpiClick("sow")}><KpiCard label="SOW Signed"         value={kpis.sowSigned} icon={ScrollText} accent="violet" /></KpiButton>
      </div>

      {/* Section cards intentionally not rendered — KPI filters scope the unified table below.
          Logic for `active` / `sowReady` is preserved above for future reuse. */}


      {/* All Leads & Clients */}
      <section className="rounded-2xl border border-border bg-card shadow-card">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-gradient-frost px-5 py-4">
          <h2 className="text-base font-semibold text-navy">
            All Leads &amp; Clients
            {kpiFilter && <span className="ml-2 text-xs font-normal text-muted-foreground">· filtered by {kpiLabel(kpiFilter)}</span>}
          </h2>
          <span className="text-xs text-muted-foreground">{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
        </header>

        <PipelineTable
          rows={paged}
          sortField={sortField} sortDir={sortDir} onSort={onSort}
          onProfile={goProfile} onCalc={goCalc} onEdit={(l) => setEditing(l)}
          onSignSow={(l) => { setStatus(l.id, "sow_signed"); toast.success("SOW signed", { description: l.company }); }}
          onStartEng={(l) => { promote(l.id); toast.success("Engagement started", { description: l.company }); }}
          onDelete={(l) => setPendingDelete(l.id)}
          emptyText="No leads match your filters."
        />

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span>Page {page} of {pageCount}</span>
            <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </section>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. KPIs will update automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) { deleteLead(pendingDelete); toast.success("Lead deleted"); }
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && (
        <EditClientDialog lead={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      )}
    </div>
  );
}

function kpiLabel(f: Exclude<KpiFilter, null>) {
  return { total: "Total", new: "New", active: "Active", calc: "Calculations Sent", sow: "SOW Signed" }[f];
}

function KpiButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
        active && "ring-2 ring-cyan ring-offset-2 ring-offset-background",
      )}
    >
      {children}
    </button>
  );
}

// — Unified table used by all three sections —
interface TableProps {
  rows: Lead[];
  sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void;
  onProfile: (l: Lead) => void;
  onCalc: (l: Lead) => void;
  onEdit: (l: Lead) => void;
  onSignSow: (l: Lead) => void;
  onStartEng: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  emptyText?: string;
}

function PipelineTable(p: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <SortableTh label="Status"  field="status"   sortField={p.sortField} sortDir={p.sortDir} onSort={p.onSort} />
            <SortableTh label="Years"   field="years"    sortField={p.sortField} sortDir={p.sortDir} onSort={p.onSort} />
            <SortableTh label="Representative" field="rep" sortField={p.sortField} sortDir={p.sortDir} onSort={p.onSort} />
            <SortableTh label="Entities" field="entities" sortField={p.sortField} sortDir={p.sortDir} onSort={p.onSort} />
            <SortableTh label="Latest Calculation" field="latest" sortField={p.sortField} sortDir={p.sortDir} onSort={p.onSort} />
            <SortableTh label="Added"   field="added"    sortField={p.sortField} sortDir={p.sortDir} onSort={p.onSort} />
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.length === 0 && (
            <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">{p.emptyText ?? "No records."}</td></tr>
          )}
          {p.rows.map((l) => (
            <motion.tr
              key={l.id}
              layout
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
            >
              <td className="px-5 py-3">
                <StatusBadge status={l.status} />
                <p className="mt-1 font-medium text-navy">{l.company}</p>
                <p className="text-xs text-muted-foreground">{l.fullName}</p>
              </td>
              <td className="px-5 py-3"><YearChips years={l.taxYears} /></td>
              <td className="px-5 py-3">{l.rep}</td>
              <td className="px-5 py-3 tabular-nums">{l.entitiesCount}</td>
              <td className="px-5 py-3 text-muted-foreground">{l.latestCalculation}</td>
              <td className="px-5 py-3 text-muted-foreground">{formatDate(l.addedAt)}</td>
              <td className="px-5 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => p.onProfile(l)}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => p.onEdit(l)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => p.onCalc(l)}><Calculator className="mr-2 h-4 w-4" /> Create Calculation</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => p.onSignSow(l)}><FileSignature className="mr-2 h-4 w-4" /> Sign SOW</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => p.onStartEng(l)}><PlayCircle className="mr-2 h-4 w-4" /> Start Engagement</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => p.onDelete(l)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableTh({ label, field, sortField, sortDir, onSort }: {
  label: string; field: SortField; sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void;
}) {
  const isActive = sortField === field;
  const Icon = !isActive ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-5 py-3">
      <button
        onClick={() => onSort(field)}
        className={cn("inline-flex items-center gap-1 transition-colors hover:text-navy", isActive && "text-navy")}
      >
        {label}
        <Icon className={cn("h-3 w-3 transition-opacity", isActive ? "opacity-100" : "opacity-50")} />
      </button>
    </th>
  );
}

function SectionCard({ title, count, accent = "navy", children }: { title: string; count: number; accent?: "navy" | "violet"; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border bg-gradient-frost px-5 py-4">
        <div className="flex items-center gap-2">
          <span className={cn("inline-block h-2 w-2 rounded-full", accent === "violet" ? "bg-violet" : "bg-green")} />
          <h2 className="text-base font-semibold text-navy">{title}</h2>
        </div>
        <span className="text-xs text-muted-foreground">{count} record{count === 1 ? "" : "s"}</span>
      </header>
      {children}
    </section>
  );
}
