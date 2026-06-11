// Client Pipeline — three sections + KPI-driven filtering, search, and sortable table.

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Users,
  Phone,
  Layers,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calculator,
  FileSignature,
  FileText,
  ScrollText,
  Briefcase,
  Pencil,
  Trash2,
  MoreHorizontal,
  X,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/pipeline/StatusBadge";
import { AddLeadDialog } from "@/components/pipeline/AddLeadDialog";
import { EditClientDialog } from "@/components/pipeline/EditClientDialog";
import { YearChips } from "@/components/MultiYearSelect";
import { useLeadsStore } from "@/store/leadsStore";
import type { Lead, LeadStatus } from "@/types/crm";
import { PIPELINE_STAGES } from "@/types/crm";
import { formatDate, formatLocalDate } from "@/utils/format";
import { buildCalculationSearch, hasExistingCalculation } from "@/utils/calculationContext";
import { cn } from "@/lib/utils";

type KpiFilter = LeadStatus | "total" | null;
type SortField = "status" | "rep" | "entities" | "latest" | "added" | "years";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

export function PipelinePage() {
  const leads = useLeadsStore((s) => s.leads);
  const loading = useLeadsStore((s) => s.loading);
  const error = useLeadsStore((s) => s.error);
  const fetchLeads = useLeadsStore((s) => s.fetchLeads);
  const deleteLead = useLeadsStore((s) => s.deleteLead);
  const setStatus = useLeadsStore((s) => s.setStatus);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const [query, setQuery] = useState("");
  const [repFilter, setRepFilter] = useState("");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [sortField, setSortField] = useState<SortField>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);

  const repOptions = useMemo(
    () => [...new Set(leads.map((l) => l.rep).filter(Boolean))].sort(),
    [leads],
  );

  const repFilteredLeads = useMemo(
    () => (repFilter ? leads.filter((l) => l.rep === repFilter) : leads),
    [leads, repFilter],
  );

  const kpis = useMemo(() => {
    const count = (s: LeadStatus) => repFilteredLeads.filter((l) => l.status === s).length;
    return {
      total: repFilteredLeads.length,
      new_lead: count("new_lead"),
      intro_call: count("intro_call"),
      feasibility_call: count("feasibility_call"),
      tax_preparer_coordination: count("tax_preparer_coordination"),
      closed: count("closed"),
    };
  }, [repFilteredLeads]);

  const isFiltered = !!kpiFilter || query.trim().length > 0 || !!repFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = repFilteredLeads.filter((l) => {
      const matchQ =
        !q || l.fullName.toLowerCase().includes(q) || l.company.toLowerCase().includes(q);
      const matchK = !kpiFilter || kpiFilter === "total" || l.status === kpiFilter;
      return matchQ && matchK;
    });
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "rep":
          return a.rep.localeCompare(b.rep) * dir;
        case "entities":
          return (a.entitiesCount - b.entitiesCount) * dir;
        case "latest":
          return a.latestCalculation.localeCompare(b.latestCalculation) * dir;
        case "added":
          return (new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()) * dir;
        case "years":
          return (a.taxYears.length - b.taxYears.length) * dir;
      }
    });
    return rows;
  }, [repFilteredLeads, query, kpiFilter, sortField, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goCalc = (l: Lead) => {
    navigate({ to: "/", search: buildCalculationSearch(l) as never });
  };
  const goProfile = (l: Lead) => navigate({ to: "/clients/$id", params: { id: l.id } });

  const onSort = (f: SortField) => {
    if (f === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(f);
      setSortDir("asc");
    }
  };

  const clearAll = () => {
    setKpiFilter(null);
    setQuery("");
    setRepFilter("");
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
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by entity or client name..."
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={repFilter}
                onChange={(e) => {
                  setRepFilter(e.target.value);
                  setPage(1);
                }}
                className={[
                  "h-10 rounded-md border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan appearance-none",
                  repFilter
                    ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    : "border-input bg-background text-foreground",
                ].join(" ")}
              >
                <option value="">All representatives</option>
                {repOptions.map((rep) => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
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
          {repFilter && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-600/30 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <Users className="h-3 w-3" />
                Showing: {repFilter}
                <button
                  onClick={() => { setRepFilter(""); setPage(1); }}
                  className="ml-1 rounded-full hover:text-green-500"
                  aria-label="Clear rep filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Clickable KPIs — one per pipeline stage, plus Total. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiButton active={kpiFilter === "total"} onClick={() => onKpiClick("total")}>
          <KpiCard
            label="Total"
            value={kpis.total}
            icon={Layers}
            accent="navy"
            labelClassName="text-foreground"
            mini
          />
        </KpiButton>
        <KpiButton active={kpiFilter === "new_lead"} onClick={() => onKpiClick("new_lead")}>
          <KpiCard label="New Lead" value={kpis.new_lead} icon={Users} accent="cyan" mini />
        </KpiButton>
        <KpiButton active={kpiFilter === "intro_call"} onClick={() => onKpiClick("intro_call")}>
          <KpiCard label="Intro Call" value={kpis.intro_call} icon={FileText} accent="orange" mini />
        </KpiButton>
        <KpiButton
          active={kpiFilter === "feasibility_call"}
          onClick={() => onKpiClick("feasibility_call")}
        >
          <KpiCard
            label="Feasibility"
            value={kpis.feasibility_call}
            icon={ScrollText}
            accent="violet"
            mini
          />
        </KpiButton>
        <KpiButton
          active={kpiFilter === "tax_preparer_coordination"}
          onClick={() => onKpiClick("tax_preparer_coordination")}
        >
          <KpiCard
            label="Tax Preparer"
            value={kpis.tax_preparer_coordination}
            icon={Calculator}
            accent="orange"
            mini
          />
        </KpiButton>
        <KpiButton active={kpiFilter === "closed"} onClick={() => onKpiClick("closed")}>
          <KpiCard label="Closed" value={kpis.closed} icon={Briefcase} accent="green" mini />
        </KpiButton>
      </div>

      {/* Section cards intentionally not rendered — KPI filters scope the unified table below. */}

      {/* All Leads & Clients */}
      <section className="rounded-2xl border border-border bg-card shadow-card">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-gradient-frost px-5 py-4">
          <h2 className="text-base font-semibold text-navy">
            All Leads &amp; Clients
            {kpiFilter && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · filtered by {kpiLabel(kpiFilter)}
              </span>
            )}
          </h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </span>
        </header>

        {error && (
          <div className="flex items-center justify-between gap-3 border-b border-border bg-destructive/10 px-5 py-3 text-sm text-destructive">
            <span>Couldn't load leads: {error}</span>
            <Button size="sm" variant="outline" onClick={() => void fetchLeads()}>Retry</Button>
          </div>
        )}

        <PipelineTable
          rows={paged}
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
          onProfile={goProfile}
          onCalc={goCalc}
          onEdit={(l) => setEditing(l)}
          onClose={async (l) => {
            try { await setStatus(l.id, "closed"); toast.success("Lead closed", { description: l.company }); }
            catch (e) { toast.error("Couldn't close lead", { description: e instanceof Error ? e.message : undefined }); }
          }}
          onDelete={(l) => setPendingDelete(l.id)}
          emptyText={loading ? "Loading leads…" : "No leads match your filters."}
        />

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span>
              Page {page} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. KPIs will update automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const id = pendingDelete;
                setPendingDelete(null);
                if (!id) return;
                try { await deleteLead(id); toast.success("Lead deleted"); }
                catch (e) { toast.error("Couldn't delete lead", { description: e instanceof Error ? e.message : undefined }); }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && (
        <EditClientDialog
          lead={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}

function kpiLabel(f: Exclude<KpiFilter, null>) {
  if (f === "total") return "Total";
  return PIPELINE_STAGES.find((s) => s.value === f)?.label ?? f;
}

function KpiButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-full w-full rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
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
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  onProfile: (l: Lead) => void;
  onCalc: (l: Lead) => void;
  onEdit: (l: Lead) => void;
  onClose: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  emptyText?: string;
}

function PipelineTable(p: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <SortableTh
              label="Status"
              field="status"
              sortField={p.sortField}
              sortDir={p.sortDir}
              onSort={p.onSort}
            />
            <SortableTh
              label="Years"
              field="years"
              sortField={p.sortField}
              sortDir={p.sortDir}
              onSort={p.onSort}
            />
            <SortableTh
              label="Representative"
              field="rep"
              sortField={p.sortField}
              sortDir={p.sortDir}
              onSort={p.onSort}
            />
            <SortableTh
              label="Entities"
              field="entities"
              sortField={p.sortField}
              sortDir={p.sortDir}
              onSort={p.onSort}
            />
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Next Call
            </th>
            <SortableTh
              label="Latest Calculation"
              field="latest"
              sortField={p.sortField}
              sortDir={p.sortDir}
              onSort={p.onSort}
            />
            <SortableTh
              label="Added"
              field="added"
              sortField={p.sortField}
              sortDir={p.sortDir}
              onSort={p.onSort}
            />
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">
                {p.emptyText ?? "No records."}
              </td>
            </tr>
          )}
          {p.rows.map((l) => (
            <motion.tr
              key={l.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => p.onProfile(l)}
              className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors cursor-pointer"
            >
              <td className="px-5 py-3">
                <StatusBadge status={l.status} />
                <p className="mt-1 font-medium text-navy">{l.fullName}</p>
                <p className="text-xs text-muted-foreground">{l.company}</p>
              </td>
              <td className="px-5 py-3">
                <YearChips years={l.taxYears} />
              </td>
              <td className="px-5 py-3">{l.rep}</td>
              <td className="px-5 py-3">
                <EntityCell names={l.entityNames ?? []} count={l.entitiesCount} />
              </td>
              <td className="px-5 py-3">
                <NextCallCell lead={l} />
              </td>
              <td className="px-5 py-3 text-muted-foreground">
                {l.latestCalculation === "—" ? "—" : formatDate(l.latestCalculation)}
              </td>
              <td className="px-5 py-3 text-muted-foreground">{formatLocalDate(l.addedAt)}</td>
              <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => p.onEdit(l)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => p.onCalc(l)}>
                      <Calculator className="mr-2 h-4 w-4" />
                      {hasExistingCalculation(l)
                        ? "Open Existing Calculation"
                        : "Create Calculation"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => p.onClose(l)}>
                      <FileSignature className="mr-2 h-4 w-4" /> Mark Closed
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => p.onDelete(l)}
                    >
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

function SortableTh({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const isActive = sortField === field;
  const Icon = !isActive ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-5 py-3">
      <button
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-navy",
          isActive && "text-navy",
        )}
      >
        {label}
        <Icon
          className={cn("h-3 w-3 transition-opacity", isActive ? "opacity-100" : "opacity-50")}
        />
      </button>
    </th>
  );
}

const ENTITY_PREVIEW = 3;

function EntityCell({ names, count }: { names: string[]; count: number }) {
  const [expanded, setExpanded] = useState(false);
  const filtered = names.filter(Boolean);

  if (filtered.length === 0) {
    return count > 0 ? (
      <span className="text-sm text-muted-foreground">
        {count} {count === 1 ? "entity" : "entities"}
      </span>
    ) : (
      <span className="text-sm text-muted-foreground">—</span>
    );
  }

  const visible = expanded ? filtered : filtered.slice(0, ENTITY_PREVIEW);
  const overflow = filtered.length - ENTITY_PREVIEW;

  return (
    <div className="space-y-0.5">
      {visible.map((name) => (
        <p key={name} className="text-sm text-navy leading-snug">
          {name}
        </p>
      ))}
      {overflow > 0 && !expanded && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="mt-0.5 text-xs font-medium text-cyan hover:underline"
        >
          +{overflow} more
        </button>
      )}
      {expanded && filtered.length > ENTITY_PREVIEW && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="mt-0.5 text-xs font-medium text-muted-foreground hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// The call a lead schedules next, keyed by its current pipeline stage. A lead's
// status is the call it's working through, so the next call is the following
// stage's (e.g. Feasibility Call → schedule the Tax Preparer Call). `closed`
// is terminal, so there's nothing left to schedule.
const NEXT_CALL_BY_STATUS: Record<LeadStatus, string | null> = {
  new_lead: "Intro Call",
  intro_call: "Feasibility Call",
  feasibility_call: "Tax Preparer Call",
  tax_preparer_coordination: "Close Call",
  closed: null,
};

function NextCallCell({ lead }: { lead: Lead }) {
  const nc = lead.nextCall;
  if (!nc) {
    const nextCall = NEXT_CALL_BY_STATUS[lead.status];
    if (!nextCall) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan/[0.07] px-2.5 py-0.5 text-xs font-medium text-cyan">
        <AlertTriangle className="h-3 w-3" /> Schedule {nextCall}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/8 px-2.5 py-0.5 text-xs font-medium text-cyan">
      <Phone className="h-3 w-3 shrink-0" />
      {formatDate(nc.date)}
      {nc.callType ? ` · ${nc.callType}` : ""}
    </span>
  );
}

function SectionCard({
  title,
  count,
  accent = "navy",
  children,
}: {
  title: string;
  count: number;
  accent?: "navy" | "violet";
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border bg-gradient-frost px-5 py-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              accent === "violet" ? "bg-violet" : "bg-green",
            )}
          />
          <h2 className="text-base font-semibold text-navy">{title}</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {count} record{count === 1 ? "" : "s"}
        </span>
      </header>
      {children}
    </section>
  );
}
