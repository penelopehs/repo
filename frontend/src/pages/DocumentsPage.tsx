// Document Request Overview page — KPIs, search, filtering, and request cards.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Calendar,
  FileText,
  FolderCheck,
  AlertTriangle,
  Layers,
  Clock,
  Pencil,
  Search,
  X,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/KpiCard";
import { YearChips } from "@/components/MultiYearSelect";
import { useDocumentsStore } from "@/store/documentsStore";
import { useDocConfigStore, DOC_CATEGORIES } from "@/store/docConfigStore";
// Edit Request is a dedicated full-page route (/documents/edit/$engagementId).
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { DocumentStatus, DocumentRequest } from "@/types/crm";

const STATUS_META: Record<DocumentStatus, { label: string; cls: string }> = {
  received: { label: "Complete", cls: "bg-green text-green-foreground" },
  pending: { label: "Pending", cls: "bg-orange text-orange-foreground" },
  overdue: { label: "Overdue", cls: "bg-violet text-violet-foreground" },
};

type KpiFilter = "total" | "complete" | "pending" | "overdue" | null;

const EMPTY_SELECTIONS: string[] = [];

// Master catalog of valid document names (single source of truth).
// Any seeded document outside this catalog is invalid and auto-removed.
const VALID_DOC_NAMES = new Set(DOC_CATEGORIES.flatMap((c) => c.items));

export function DocumentsPage() {
  const requests = useDocumentsStore((s) => s.requests);
  const selectionsMap = useDocConfigStore((s) => s.selectionsByEngagement);
  const seedIfEmpty = useDocConfigStore((s) => s.seedIfEmpty);

  // Seed shared store from request snapshots — but only with catalog-valid
  // names, so Overview can never display items that Edit Request cannot edit.
  useEffect(() => {
    requests.forEach((r) =>
      seedIfEmpty(
        r.engagementId,
        r.items.map((it) => it.type).filter((t) => VALID_DOC_NAMES.has(t)),
      ),
    );
  }, [requests, seedIfEmpty]);

  const [query, setQuery] = useState("");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);

  // Compute status per request using the SAME logic as the request card,
  // so KPI counts always match the card badges. Single source of truth.
  const statusByRequest = useMemo(() => {
    const map = new Map<string, "received" | "pending" | "overdue">();
    requests.forEach((r) => {
      const seeded = r.items.map((it) => it.type).filter((t) => VALID_DOC_NAMES.has(t));
      const effective = selectionsMap[r.engagementId] ?? seeded;
      const receivedSet = new Set(r.items.filter((it) => it.received).map((it) => it.type));
      const total = effective.length;
      const received = effective.filter((t) => receivedSet.has(t)).length;
      const isComplete = total > 0 && received === total;
      const isOverdue = !isComplete && new Date(r.dueDate).getTime() < Date.now();
      map.set(r.id, isComplete ? "received" : isOverdue ? "overdue" : "pending");
    });
    return map;
  }, [requests, selectionsMap]);

  const kpis = useMemo(() => {
    let complete = 0,
      pending = 0,
      overdue = 0;
    statusByRequest.forEach((s) => {
      if (s === "received") complete++;
      else if (s === "overdue") overdue++;
      else pending++;
    });
    return { total: requests.length, complete, pending, overdue };
  }, [requests, statusByRequest]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      const matchQ =
        !q || r.clientName.toLowerCase().includes(q) || r.recipientName.toLowerCase().includes(q);
      if (!matchQ) return false;
      if (!kpiFilter || kpiFilter === "total") return true;
      const s = statusByRequest.get(r.id);
      switch (kpiFilter) {
        case "complete":
          return s === "received";
        case "pending":
          return s === "pending";
        case "overdue":
          return s === "overdue";
      }
    });
  }, [requests, query, kpiFilter, statusByRequest]);

  const isFiltered = !!kpiFilter || query.trim().length > 0;
  const clearAll = () => {
    setQuery("");
    setKpiFilter(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Documents</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Document Request Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track every document request sent to your engaged clients.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
          <Button
            asChild
            className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated"
          >
            <Link to="/documents/configure">
              <Plus className="mr-1.5 h-4 w-4" /> Add New
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs — clickable filters */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiFilterButton
          active={kpiFilter === "total"}
          onClick={() => setKpiFilter((c) => (c === "total" ? null : "total"))}
        >
          <KpiCard
            label="Total"
            value={kpis.total}
            icon={Layers}
            accent="navy"
            labelClassName="text-[#00264A]"
          />
        </KpiFilterButton>
        <KpiFilterButton
          active={kpiFilter === "complete"}
          onClick={() => setKpiFilter((c) => (c === "complete" ? null : "complete"))}
        >
          <KpiCard label="Complete" value={kpis.complete} icon={FolderCheck} accent="green" />
        </KpiFilterButton>
        <KpiFilterButton
          active={kpiFilter === "pending"}
          onClick={() => setKpiFilter((c) => (c === "pending" ? null : "pending"))}
        >
          <KpiCard label="Pending" value={kpis.pending} icon={Clock} accent="orange" />
        </KpiFilterButton>
        <KpiFilterButton
          active={kpiFilter === "overdue"}
          onClick={() => setKpiFilter((c) => (c === "overdue" ? null : "overdue"))}
        >
          <KpiCard label="Overdue" value={kpis.overdue} icon={AlertTriangle} accent="violet" />
        </KpiFilterButton>
      </div>

      {/* Request cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((r, i) => (
            <RequestCard
              key={r.id}
              r={r}
              i={i}
              hasConfig={r.engagementId in selectionsMap}
              configSelections={selectionsMap[r.engagementId] ?? EMPTY_SELECTIONS}
            />
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No document requests match your filters.
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="mt-3 border-cyan text-cyan hover:bg-cyan/10"
              >
                <X className="mr-1.5 h-3 w-3" /> Clear Filter
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiFilterButton({
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
        "rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
        active && "ring-2 ring-cyan ring-offset-2 ring-offset-background",
      )}
    >
      {children}
    </button>
  );
}

interface RequestCardProps {
  r: DocumentRequest;
  i: number;
  hasConfig: boolean;
  configSelections: string[];
}

function RequestCard({ r, i, hasConfig, configSelections }: RequestCardProps) {
  const toggleItem = useDocConfigStore((s) => s.toggleItem);
  const setCategoryAll = useDocConfigStore((s) => s.setCategoryAll);

  // Single source of truth: if engagement has any configured state, use it;
  // otherwise seed from the original request items so first-time edits don't
  // wipe the snapshot. After the user touches a checkbox, the store wins.
  const seededFromRequest = r.items.map((it) => it.type).filter((t) => VALID_DOC_NAMES.has(t));
  const effective = hasConfig ? configSelections : seededFromRequest;
  // selection lookup retained via receivedSet below; no separate set needed
  const totalSelected = effective.length;

  // Received lookup from the request snapshot, intersected with current selections.
  const receivedSet = new Set<string>(r.items.filter((it) => it.received).map((it) => it.type));
  const receivedCount = effective.filter((t) => receivedSet.has(t)).length;

  // Overdue = past due date AND not all selected docs received.
  const isComplete = totalSelected > 0 && receivedCount === totalSelected;
  const isOverdue = !isComplete && new Date(r.dueDate).getTime() < Date.now();
  const status: DocumentStatus = isComplete ? "received" : isOverdue ? "overdue" : "pending";
  const meta = STATUS_META[status];

  // Progress bar: received vs. currently-selected total (not the master list).
  const pct = totalSelected > 0 ? (receivedCount / totalSelected) * 100 : 0;
  const barCls = isComplete ? "bg-green" : isOverdue ? "bg-violet" : "bg-orange";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: i * 0.04 }}
      className={cn(
        "rounded-2xl border bg-card shadow-card hover:shadow-elevated transition-shadow",
        isOverdue
          ? "border-violet/40 ring-1 ring-violet/20"
          : isComplete
            ? "border-green/40"
            : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-navy/30 text-navy font-mono">
              {r.engagementId}
            </Badge>
            <Badge variant="outline" className="border-cyan/30 text-cyan font-mono">
              {r.id}
            </Badge>
          </div>
          <h3 className="mt-2 text-base font-semibold text-navy">{r.clientName}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" /> {r.recipientName} · {r.recipientEmail}
          </p>
        </div>
        <Badge className={cn(meta.cls, "shrink-0")}>{meta.label}</Badge>
      </header>

      <div className="grid gap-4 p-5">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">
              Tax Years
            </p>
            <div className="mt-1.5">
              <YearChips years={r.taxYears} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-semibold uppercase tracking-wider text-muted-foreground">Sent</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-navy">
                <Calendar className="h-3 w-3" /> {formatDate(r.sentDate)}
              </p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wider text-muted-foreground">Due</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-navy">
                <Calendar className="h-3 w-3" /> {formatDate(r.dueDate)}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
              DOCUMENTS
            </span>
            <span className="font-semibold tabular-nums text-navy">
              ({receivedCount} / {totalSelected})
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn("h-full", barCls)}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>

        <details className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-navy">
            <FileText className="mr-1 inline h-3 w-3" /> View document types ({totalSelected})
          </summary>
          {totalSelected === 0 ? (
            <p className="mt-2 italic text-muted-foreground">
              No documents selected for this request
            </p>
          ) : (
            <p className="mt-3 leading-relaxed text-navy">
              {effective.map((item, idx) => {
                const isReceived = receivedSet.has(item);
                return (
                  <span key={item}>
                    <span
                      className={cn("font-medium", isReceived ? "text-green" : "text-destructive")}
                    >
                      {item}
                    </span>
                    {idx < effective.length - 1 && (
                      <span className="text-muted-foreground">, </span>
                    )}
                  </span>
                );
              })}
            </p>
          )}

          {/* Hidden controls kept mounted so the shared store toggle handlers
              remain in scope (selections still managed from Configure Request). */}
          <div className="hidden">
            {DOC_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryAll(r.engagementId, cat.id, false)}
              >
                {cat.title}
              </button>
            ))}
            <button type="button" onClick={() => toggleItem(r.engagementId, "")}>
              noop
            </button>
          </div>
        </details>

        <Button
          asChild
          size="sm"
          variant="outline"
          className="w-full border-cyan text-cyan hover:bg-cyan/10"
        >
          <Link to="/documents/edit/$engagementId" params={{ engagementId: r.engagementId }}>
            <Pencil className="mr-1 h-3 w-3" /> Edit Request
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
