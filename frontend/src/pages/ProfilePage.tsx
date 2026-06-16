// View Profile page — client overview with engagements, contacts, calls, intake.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Mail,
  Phone,
  Plus,
  X,
  Users,
  Layers,
  CalendarClock,
  Pencil,
  Trash2,
  Calculator as CalcIcon,
  Loader2,
  Star,
  Clock,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info as InfoIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KpiCard } from "@/components/KpiCard";
import { YearChips } from "@/components/MultiYearSelect";
import { StatusBadge } from "@/components/pipeline/StatusBadge";
import { useLeadsStore } from "@/store/leadsStore";
import { entitiesFromLead, stripEntityIds } from "@/store/calculatorStore";
import { useFollowUpCallsStore } from "@/store/followUpCallsStore";
import { useIntakeNotesStore } from "@/store/intakeNotesStore";
import { ScheduleCallDialog } from "@/components/profile/ScheduleCallDialog";
import { EditClientDialog } from "@/components/pipeline/EditClientDialog";
import { formatCurrency, formatDate, formatLocalDate, formatTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { buildCalculationSearch } from "@/utils/calculationContext";
import { pipelineStageIndex, PIPELINE_STAGES, EMPTY_CALCULATIONS } from "@/types/crm";
import type {

  FollowUpCall,
  ProfileNote,
  TaxYearRecord,
  TaxYearStatus,
} from "@/types/crm";
import { useUsersStore } from "@/store/usersStore";

// The four scheduled calls a lead works through after "New Lead". Their order
// mirrors the pipeline stages (intro_call → feasibility_call →
// tax_preparer_coordination → closed); a lead's stage index says how many of
// these calls are done.
const CALL_STEPS = [
  { title: "Intro Call", noun: "intro call" },
  { title: "Feasibility Call", noun: "feasibility call" },
  { title: "Tax Prepare Call", noun: "tax preparer call" },
  { title: "Close Call", noun: "close call" },
] as const;

// Stable empty reference so the zustand selector below doesn't return a fresh
// array on every read (which would make useSyncExternalStore loop forever).
const NO_CALLS: FollowUpCall[] = [];
const NO_NOTES: ProfileNote[] = [];

export function ProfilePage({ id }: { id: string }) {
  const me = useUsersStore((s) => s.me);
  const ensureUsers = useUsersStore((s) => s.ensureLoaded);
  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === id));
  const updateLead = useLeadsStore((s) => s.updateLead);
  const fetchLead = useLeadsStore((s) => s.fetchLead);
  // Start in the loading state when the lead isn't already cached, so a direct
  // load shows a spinner rather than a flash of "Client not found".
  const [leadLoading, setLeadLoading] = useState(!lead);
  const calls = useFollowUpCallsStore((s) => s.byLead[id] ?? NO_CALLS);
  const fetchCalls = useFollowUpCallsStore((s) => s.fetch);
  const updateCall = useFollowUpCallsStore((s) => s.update);
  const intakeNotes = useIntakeNotesStore((s) => s.byLead[id] ?? NO_NOTES);
  const fetchIntakeNotes = useIntakeNotesStore((s) => s.fetch);
  const addIntakeNote = useIntakeNotesStore((s) => s.add);
  const updateIntakeNote = useIntakeNotesStore((s) => s.update);
  const removeIntakeNote = useIntakeNotesStore((s) => s.remove);
  const navigate = useNavigate();
  const [openCall, setOpenCall] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingCall, setEditingCall] = useState<FollowUpCall | null>(null);
  const [newNote, setNewNote] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<{
    firstName: string;
    lastName: string;
    role: string;
    emails: string[];
    phones: string[];
    entityIds: string[];
  }>({
    firstName: "",
    lastName: "",
    role: "",
    emails: [""],
    phones: [""],
    entityIds: [],
  });

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  const [contactError, setContactError] = useState("");
  const [contactSaved, setContactSaved] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityDraft, setEntityDraft] = useState({ name: "", ein: "", city: "", state: "" });
  const [entitySaving, setEntitySaving] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Flash the transient "Saved" indicator in the Intake Notes card header.
  const flashNoteSaved = () => {
    setNoteSaved(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setNoteSaved(false), 2500);
  };

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text || savingNote) return;
    setSavingNote(true);
    try {
      await addIntakeNote(id, text);
      setNewNote("");
      flashNoteSaved();
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const startEditNote = (note: ProfileNote) => {
    setEditingNoteId(note.id);
    setEditDraft(note.text);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async (noteId: string) => {
    const text = editDraft.trim();
    if (!text || savingNote) return;
    setSavingNote(true);
    try {
      await updateIntakeNote(id, noteId, text);
      cancelEditNote();
      flashNoteSaved();
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      await removeIntakeNote(id, noteId);
      if (editingNoteId === noteId) cancelEditNote();
      flashNoteSaved();
    } catch {
      toast.error("Failed to delete note");
    }
  };

  // Toggle a follow-up call's completed state. The store refreshes the lead
  // afterwards, so the Call Progress / status badge (driven off the lead) and
  // the call's own completed flag stay in sync.
  const handleToggleCallComplete = async (call: FollowUpCall) => {
    await updateCall(id, call.id, { completed: !call.completed });
  };

  const engagements = useMemo(() => lead?.engagements ?? [], [lead?.engagements]);

  // Hydrate the lead on a direct page load (the pipeline list may not be in memory).
  useEffect(() => {
    if (!lead) {
      setLeadLoading(true);
      void fetchLead(id).finally(() => setLeadLoading(false));
    }
  }, [id, lead, fetchLead]);

  useEffect(() => {
    void ensureUsers();
  }, [ensureUsers]);

  useEffect(() => {
    void fetchCalls(id);
  }, [fetchCalls, id]);

  useEffect(() => {
    void fetchIntakeNotes(id);
  }, [fetchIntakeNotes, id]);

  useEffect(() => {
    const now = new Date();
    calls.forEach((c) => {
      if (!c.completed && new Date(`${c.date}T${c.time}`) < now) {
        void updateCall(id, c.id, { completed: true });
      }
    });
  }, [calls, updateCall, id]);

  const chartData = useMemo(() => {
    const map = new Map<number, number>();
    engagements.forEach((e) =>
      e.billing.forEach((b) => map.set(b.year, (map.get(b.year) || 0) + b.amount)),
    );
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, amount]) => ({ year: String(year), amount }));
  }, [engagements]);

  const engagementYears = useMemo(() => {
    const ys = new Set<number>();
    engagements.forEach((e) => e.years.forEach((y) => ys.add(y)));
    return Array.from(ys).sort();
  }, [engagements]);

  const grandTotal = chartData.reduce((s, r) => s + r.amount, 0);

  const upcomingCalls = calls.filter(
    (c) => new Date(`${c.date}T${c.time}`).getTime() >= Date.now(),
  ).length;

  // Soonest pending future call — drives the "active" Call Progress step.
  const nextCall = useMemo(() => {
    const future = calls
      .filter((c) => !c.completed && new Date(`${c.date}T${c.time}`).getTime() >= Date.now())
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime(),
      );
    return future[0] ?? null;
  }, [calls]);

  if (!lead) {
    if (leadLoading) {
      return (
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy">Client not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This client no longer exists.</p>
        <Button className="mt-6" onClick={() => navigate({ to: "/pipeline" })}>
          Back to Pipeline
        </Button>
      </div>
    );
  }

  // People & Contacts live on the lead's `data.people[]` and persist via PATCH /leads/{id}.
  const people = lead.data?.people ?? [];

  // Call Progress: the lead advances one pipeline stage each time a call is
  // *scheduled*, so stageIndex is the number of scheduled calls (0 = New Lead).
  const stageIndex = pipelineStageIndex(lead.status);
  // The call working the lead's current stage (undefined for a brand-new lead).
  // While it's still open the next step can't be scheduled yet, so the pipeline
  // is "in progress" on this call rather than on the next step.
  const currentCall = calls.find((c) => c.callType === lead.status);
  const currentOpen = !!currentCall && !currentCall.completed;
  const activeStep = stageIndex < CALL_STEPS.length ? CALL_STEPS[stageIndex] : null;
  const introCallCompleted =
    calls.some((c) => c.callType === "intro_call" && c.completed) || stageIndex >= 2;
  // Warn when the in-progress call has no upcoming follow-up scheduled yet.
  const needsCall = !!activeStep && upcomingCalls === 0;

  const resetContactForm = () => {
    setContactForm({
      firstName: "",
      lastName: "",
      role: "",
      emails: [""],
      phones: [""],
      entityIds: [],
    });
    setContactError("");
    setEditingContactId(null);
    setIsAddingContact(false);
  };

  // Entity ⇄ people links (lead.data.entityPeople), keyed by entity id. Edited
  // through the contact form (saveContact/removeContact write entityPeople).
  const entityPeople = lead.data?.entityPeople ?? {};

  // Reverse lookup: entities a given person is linked to (derived, not stored).
  const entitiesForPerson = (personId: string) =>
    (lead.data?.entities ?? []).filter((e) => (entityPeople[e.id] ?? []).includes(personId));

  const flashSaved = () => {
    setContactSaved(true);
    window.setTimeout(() => setContactSaved(false), 2500);
  };

  const startEditEntity = (e: { id: string; name: string; ein?: string; city?: string; state?: string }) => {
    setEditingEntityId(e.id);
    setEntityDraft({ name: e.name, ein: e.ein ?? "", city: e.city ?? "", state: e.state ?? "" });
  };

  const saveEntity = async () => {
    if (!editingEntityId || !lead.data) return;
    setEntitySaving(true);
    const updatedEntities = (lead.data.entities ?? []).map((e) =>
      e.id === editingEntityId
        ? { ...e, name: entityDraft.name.trim(), ein: entityDraft.ein.trim(), city: entityDraft.city.trim(), state: entityDraft.state.trim() }
        : e,
    );
    try {
      await updateLead(id, { data: { ...lead.data, entities: updatedEntities } });
      setEditingEntityId(null);
      toast.success("Entity updated.");
    } catch {
      toast.error("Failed to save entity.");
    } finally {
      setEntitySaving(false);
    }
  };

  const saveContact = async () => {
    const fields = {
      firstName: contactForm.firstName.trim(),
      lastName: contactForm.lastName.trim(),
      role: contactForm.role.trim(),
      // Drop blank rows and de-dupe; one-to-many with no labels.
      emails: [...new Set(contactForm.emails.map((v) => v.trim()).filter(Boolean))],
      phones: [...new Set(contactForm.phones.map((v) => v.trim()).filter(Boolean))],
    };
    if (!fields.firstName || !fields.lastName || !fields.role) {
      setContactError("First name, last name, and role are required.");
      return;
    }
    const personId = editingContactId ?? `person_${Date.now()}`;
    const nextPeople = editingContactId
      ? people.map((p) => (p.id === editingContactId ? { ...p, ...fields } : p))
      : [...people, { id: personId, ...fields }];

    // Sync the entity↔people links from the picked entities: add this person to
    // every selected entity and remove them from the rest.
    const selected = new Set(contactForm.entityIds);
    const nextEntityPeople: Record<string, string[]> = {};
    for (const e of lead.data?.entities ?? []) {
      const without = (entityPeople[e.id] ?? []).filter((pid) => pid !== personId);
      const members = selected.has(e.id) ? [...without, personId] : without;
      if (members.length > 0) nextEntityPeople[e.id] = members;
    }

    const base = lead.data ?? { people: [], entities: [], calculations: EMPTY_CALCULATIONS };
    try {
      await updateLead(id, {
        data: { ...base, people: nextPeople, entityPeople: nextEntityPeople },
      });
      resetContactForm();
      flashSaved();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "Couldn't save contact.");
    }
  };

  const removeContact = async () => {
    if (!editingContactId) return;
    const nextPeople = people.filter((p) => p.id !== editingContactId);
    // Drop the removed person from every entity link.
    const nextEntityPeople: Record<string, string[]> = {};
    for (const [entityId, ids] of Object.entries(entityPeople)) {
      const members = ids.filter((pid) => pid !== editingContactId);
      if (members.length > 0) nextEntityPeople[entityId] = members;
    }
    const base = lead.data ?? { people: [], entities: [], calculations: EMPTY_CALCULATIONS };
    try {
      await updateLead(id, {
        data: { ...base, people: nextPeople, entityPeople: nextEntityPeople },
      });
      resetContactForm();
      flashSaved();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "Couldn't remove contact.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Top actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pipeline" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setOpenEdit(true)}>
          <Pencil className="mr-1.5 h-4 w-4" /> Edit Client
        </Button>
      </div>

      <div className="rounded-[18px] border border-border bg-card p-6 sm:p-7 shadow-card mb-5 flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-4 min-w-[280px]">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-white text-base font-bold tracking-wide shadow-sm">
            {lead.fullName
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Client</p>
            <h1 className="text-2xl font-bold text-navy">{lead.fullName}</h1>
            <p className="text-sm text-muted-foreground">{lead.company}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              {needsCall && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/[0.07] px-2.5 py-1 text-xs font-medium text-cyan">
                  <AlertTriangle className="h-3 w-3" /> No {activeStep.noun} scheduled
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* R&D Tax Credit History */}
      <TaxHistoryPanel
        lead={lead}
        onUpdate={async (yearStatuses) => {
          const base = lead.data ?? { people: [], entities: [], calculations: EMPTY_CALCULATIONS };
          // Mirror every engaged year into its own calculation: a copy of the
          // master entity list in the calculator's saved (id-less) format. Years
          // that already hold a non-empty calculation are left untouched; the
          // default for a year is [].
          const masterCards = stripEntityIds(entitiesFromLead(base.entities ?? []));
          const calculations: Record<string, unknown> = { ...(base.calculations ?? {}) };
          for (const [year, record] of Object.entries(yearStatuses)) {
            if (record.status === "engaged" || record.status === "current_engaged") {
              const existing = calculations[year];
              if (!Array.isArray(existing) || existing.length === 0) {
                calculations[year] = masterCards;
              }
            }
          }
          await updateLead(id, { data: { ...base, yearStatuses, calculations } });
        }}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            {
              label: "Total Entities",
              value: lead.data?.entities?.length ?? 0,
              icon: Layers,
              accent: "navy",
              target: "section-entities",
            },
            {
              label: "Total Contacts",
              value: people.length,
              icon: Users,
              accent: "cyan",
              target: "section-contacts",
            },
            {
              label: "Total Engagements",
              value: engagements.length,
              icon: Briefcase,
              accent: "orange",
              target: "section-engagements",
            },
            {
              label: "Upcoming Calls",
              value: upcomingCalls,
              icon: CalendarClock,
              accent: "green",
              target: "section-calls",
            },
          ] as const
        ).map(({ label, value, icon, accent, target }) => (
          <button
            key={target}
            type="button"
            onClick={() =>
              document
                .getElementById(target)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan hover:scale-[1.02]"
          >
            <KpiCard label={label} value={value} icon={icon} accent={accent} />
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Call Progress */}
          <Card title="Call Progress">
            <ol className="space-y-2">
              {CALL_STEPS.map((step, i) => {
                // Each scheduled call advances the stage, so steps below
                // stageIndex already have a call — completed or merely scheduled.
                // Look up this stage's call to tell the two apart (a
                // scheduled-but-open call reads as "Scheduled", not "Completed").
                // The step at stageIndex only becomes "active" once the current
                // call is completed; while it's still open, the next step stays
                // pending so just one step shows as in progress.
                const stepStatus = PIPELINE_STAGES[i + 1]?.value;
                const stepCall = calls.find((c) => c.callType === stepStatus);
                const state =
                  stepCall && !stepCall.completed
                    ? "scheduled"
                    : i < stageIndex
                      ? "done"
                      : i === stageIndex && !currentOpen
                        ? "active"
                        : "pending";
                const sub =
                  state === "done"
                    ? "Completed"
                    : state === "scheduled"
                      ? `Scheduled for ${formatDate(stepCall!.date)}`
                      : state === "active"
                        ? nextCall
                          ? `Scheduled for ${formatDate(nextCall.date)}`
                          : "Not yet scheduled"
                        : i === CALL_STEPS.length - 1
                          ? "Pending prior steps"
                          : `Pending ${CALL_STEPS[i - 1].noun}`;
                const Icon = state === "done" ? CheckCircle2 : Circle;
                const highlighted = state === "active" || state === "scheduled";
                return (
                  <li
                    key={step.title}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                      highlighted ? "border-cyan/50 bg-cyan/5" : "border-border",
                      state === "pending" && "opacity-60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        state === "done"
                          ? "text-green-600"
                          : highlighted
                            ? "text-cyan"
                            : "text-muted-foreground",
                      )}
                    />
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          state === "pending" ? "text-muted-foreground" : "text-navy",
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                      {/* Feasibility Call action button */}
                      {i === 1 && state !== "done" && (
                        <div className="mt-2.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={state === "pending"}
                            className={cn(
                              "gap-1.5",
                              state === "scheduled" || state === "active"
                                ? "border-cyan/50 text-cyan hover:bg-cyan/10"
                                : "opacity-50",
                            )}
                            onClick={() =>
                              navigate({
                                to: "/clients/$id/feasibility-call",
                                params: { id },
                                search: { callId: undefined },
                              })
                            }
                          >
                            Go to Feasibility Call <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                          {state === "pending" && (
                            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <InfoIcon className="h-3 w-3 shrink-0" /> Schedule the Feasibility Call to enable
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* General Info */}
          <Card title="General Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Lead Source" value={lead.source} />
              <Info
                label="Client Since"
                value={lead.engagedSince ? formatDate(lead.engagedSince) : formatLocalDate(lead.addedAt)}
              />
              <Info label="Phone" value={lead.phone ? formatPhone(lead.phone) : lead.phone} icon={<Phone className="h-3 w-3" />} />
              <Info label="Email" value={lead.email} icon={<Mail className="h-3 w-3" />} />
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </p>
              <p className="mt-1 text-sm text-navy">{lead.notes || "No notes yet."}</p>
            </div>
          </Card>

          {/* Intake Notes */}
          <Card
            title="Intake Notes"
            action={
              <span
                className={`inline-block transform transition-all duration-300 ease-out ${
                  noteSaved
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-1 pointer-events-none"
                }`}
              >
                <span className="text-sm text-green-600">Saved</span>
              </span>
            }
          >
            <div className="space-y-4">
              {/* Add a new note — always visible at the top. */}
              <div className="space-y-2">
                <Textarea
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleAddNote();
                    }
                  }}
                  placeholder="Add an intake note or comment…"
                  className="min-h-[88px]"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleAddNote}
                    disabled={newNote.trim().length === 0 || savingNote}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add note
                  </Button>
                </div>
              </div>

              {/* Existing notes, newest first. */}
              {intakeNotes.length > 0 ? (
                <div className="space-y-3">
                  {intakeNotes.map((note) => {
                    const editing = editingNoteId === note.id;
                    return (
                      <div
                        key={note.id}
                        className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-navy"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            By {note.author ?? lead.rep}
                          </span>
                          <div className="flex items-center gap-3">
                            <span>
                              {new Date(note.createdAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              <span className="text-cyan">
                                {new Date(note.createdAt).toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            </span>
                            {!editing && (
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => startEditNote(note)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() => handleDeleteNote(note.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {editing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                  event.preventDefault();
                                  void handleSaveEdit(note.id);
                                }
                                if (event.key === "Escape") cancelEditNote();
                              }}
                              autoFocus
                              className="min-h-[88px]"
                              rows={3}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditNote}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(note.id)}
                                disabled={editDraft.trim().length === 0 || savingNote}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{note.text}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No intake notes yet.</p>
              )}
            </div>
          </Card>

          {/* Entities */}
          <Card title="Entities" id="section-entities">
            <div className="overflow-x-auto">
              {(() => {
                const entities = lead.data?.entities ?? [];
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Entity Name</th>
                        <th className="px-4 py-3">EIN</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Associated Contacts</th>
                        <th className="px-4 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {entities.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-sm text-muted-foreground"
                          >
                            No entities recorded.
                          </td>
                        </tr>
                      ) : (
                        entities.map((e) => {
                          const linkedIds = entityPeople[e.id] ?? [];
                          const linked = people.filter((p) => linkedIds.includes(p.id));
                          const isEditing = editingEntityId === e.id;
                          return (
                            <tr key={e.id} className={cn("border-b border-border last:border-0", isEditing && "bg-accent/40")}>
                              <td className="px-4 py-3 font-medium text-navy">
                                {isEditing ? (
                                  <Input
                                    className="h-7 text-xs"
                                    value={entityDraft.name}
                                    onChange={(ev) => setEntityDraft((d) => ({ ...d, name: ev.target.value }))}
                                    autoFocus
                                  />
                                ) : e.name}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                                {isEditing ? (
                                  <Input
                                    className="h-7 text-xs w-32"
                                    placeholder="XX-XXXXXXX"
                                    value={entityDraft.ein}
                                    onChange={(ev) => setEntityDraft((d) => ({ ...d, ein: ev.target.value }))}
                                  />
                                ) : (e.ein || "—")}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {isEditing ? (
                                  <div className="flex gap-1.5">
                                    <Input
                                      className="h-7 text-xs w-24"
                                      placeholder="City"
                                      value={entityDraft.city}
                                      onChange={(ev) => setEntityDraft((d) => ({ ...d, city: ev.target.value }))}
                                    />
                                    <Input
                                      className="h-7 text-xs w-14"
                                      placeholder="ST"
                                      maxLength={2}
                                      value={entityDraft.state}
                                      onChange={(ev) => setEntityDraft((d) => ({ ...d, state: ev.target.value.toUpperCase() }))}
                                    />
                                  </div>
                                ) : ([e.city, e.state].filter(Boolean).join(", ") || "—")}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {linked.map((c) => (
                                    <Badge
                                      key={c.id}
                                      variant="outline"
                                      className="border-cyan/40 text-navy"
                                    >
                                      {c.firstName} {c.lastName}
                                      <span className="ml-1 text-[10px] text-muted-foreground">
                                        ({c.role})
                                      </span>
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={entitySaving}
                                      onClick={() => void saveEntity()}
                                      className="flex h-6 w-6 items-center justify-center rounded-md bg-navy text-white hover:bg-navy/80 disabled:opacity-50"
                                    >
                                      {entitySaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={entitySaving}
                                      onClick={() => setEditingEntityId(null)}
                                      className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditEntity(e)}
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-cyan hover:bg-cyan/10 hover:text-cyan"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Sales Rep — hidden when the signed-in user is this lead's own rep. */}
          {me?.iduser !== lead.repId && <Card title="Assigned Sales Representative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan/15 text-cyan text-sm font-bold ring-1 ring-cyan/25">
                {lead.rep
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-navy">{lead.rep}</p>
                <p className="text-xs text-muted-foreground">Senior Sales Representative</p>
              </div>
            </div>
          </Card>}

          {/* People & Contacts */}
          <Card
            id="section-contacts"
            title="People & Contacts"
            action={
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block transform transition-all duration-300 ease-out ${
                    contactSaved
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-1 pointer-events-none"
                  }`}
                >
                  <span className="text-sm text-green-600">Saved</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingContact((open) => !open)}
                >
                  <Plus className="mr-1 h-3 w-3" /> {isAddingContact ? "Close" : "Add Contact"}
                </Button>
              </div>
            }
          >
            {isAddingContact && (
              <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {editingContactId
                    ? "Update this contact's details."
                    : "Add a contact for this client. First name, last name, and role are required."}
                </p>
                {contactError && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertDescription>{contactError}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="contact-firstname">First Name</Label>
                      <Input
                        id="contact-firstname"
                        value={contactForm.firstName}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, firstName: e.target.value }))
                        }
                        placeholder="Jane"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-lastname">Last Name</Label>
                      <Input
                        id="contact-lastname"
                        value={contactForm.lastName}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, lastName: e.target.value }))
                        }
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="contact-role">Role</Label>
                    <Input
                      id="contact-role"
                      value={contactForm.role}
                      onChange={(e) =>
                        setContactForm((prev) => ({ ...prev, role: e.target.value }))
                      }
                      placeholder="Controller"
                    />
                  </div>
                  <MultiValueField
                    label="Emails"
                    type="email"
                    placeholder="jane@company.com"
                    values={contactForm.emails}
                    onChange={(emails) => setContactForm((prev) => ({ ...prev, emails }))}
                  />
                  <MultiValueField
                    label="Phones"
                    placeholder="(555) 123-4567"
                    format={formatPhone}
                    values={contactForm.phones}
                    onChange={(phones) => setContactForm((prev) => ({ ...prev, phones }))}
                  />
                  <div>
                    <Label className="mb-1.5 block">Associated Entities</Label>
                    {(lead.data?.entities ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No entities recorded.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(lead.data?.entities ?? []).map((e) => {
                          const checked = contactForm.entityIds.includes(e.id);
                          return (
                            <div
                              key={e.id}
                              onClick={() =>
                                setContactForm((prev) => ({
                                  ...prev,
                                  entityIds: checked
                                    ? prev.entityIds.filter((x) => x !== e.id)
                                    : [...prev.entityIds, e.id],
                                }))
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                checked
                                  ? "border-cyan bg-cyan/10 text-navy"
                                  : "border-border text-muted-foreground hover:bg-accent",
                              )}
                            >
                              <Checkbox checked={checked} className="pointer-events-none h-3 w-3" />
                              {e.name}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={saveContact}>
                    {editingContactId ? "Update Contact" : "Save Contact"}
                  </Button>
                  <Button variant="outline" onClick={resetContactForm}>
                    Cancel
                  </Button>
                </div>
                {editingContactId && (
                  <div className="mt-4 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                      onClick={removeContact}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove Contact
                    </Button>
                  </div>
                )}
              </div>
            )}
            <ul className="space-y-3">
              {people.length === 0 && (
                <li className="text-sm text-muted-foreground">No contacts.</li>
              )}
              {[...people]
                .sort((a, b) => {
                  const poc = "Point of Contact";
                  if (a.role === poc && b.role !== poc) return -1;
                  if (a.role !== poc && b.role === poc) return 1;
                  return 0;
                })
                .map((c) => (
                  <li key={c.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold text-navy">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.role}</p>
                    <div className="mt-2 space-y-0.5">
                      {c.emails.map((email) => (
                        <p key={email} className="flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-cyan" />
                          {email}
                        </p>
                      ))}
                      {c.phones.map((phone) => (
                        <p key={phone} className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-cyan" />
                          {formatPhone(phone)}
                        </p>
                      ))}
                    </div>
                    {(() => {
                      const linkedEntities = entitiesForPerson(c.id);
                      if (linkedEntities.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Layers className="h-3 w-3 text-muted-foreground" />
                          {linkedEntities.map((e) => (
                            <Badge key={e.id} variant="outline" className="border-navy/20 text-navy">
                              {e.name}
                            </Badge>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setContactForm({
                            firstName: c.firstName,
                            lastName: c.lastName,
                            role: c.role,
                            emails: c.emails.length ? c.emails : [""],
                            phones: c.phones.length ? c.phones : [""],
                            entityIds: entitiesForPerson(c.id).map((e) => e.id),
                          });
                          setEditingContactId(c.id);
                          setContactError("");
                          setIsAddingContact(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </Card>

          
          {/* Follow-up Calls */}
          <Card
            id="section-calls"
            title="Follow-up Calls"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingCall(null);
                  setOpenCall(true);
                }}
              >
                <Plus className="mr-1 h-3 w-3" /> Schedule
              </Button>
            }
          >
            {needsCall && (
              <Alert className="mb-4 border-2 border-cyan/70 bg-cyan/[0.07]">
                <AlertTriangle className="h-4 w-4 text-cyan" />
                <AlertDescription className="text-cyan">
                  Schedule {activeStep.noun} to advance this lead.
                </AlertDescription>
              </Alert>
            )}
            {calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {[...calls]
                  .sort((a, b) => {
                    if ((a.completed ?? false) !== (b.completed ?? false))
                      return Number(a.completed ?? false) - Number(b.completed ?? false);
                    const diff =
                      new Date(`${a.date}T${a.time}`).getTime() -
                      new Date(`${b.date}T${b.time}`).getTime();
                    // Pending: soonest first (ascending). Completed: most recent
                    // first (descending).
                    return a.completed ? -diff : diff;
                  })
                  .map((c) => {
                    const isToday = c.date === new Date().toISOString().slice(0, 10);
                    return (
                      <li
                        key={c.id}
                        className={`rounded-lg border p-3 text-sm transition-colors ${isToday && !c.completed ? "border-cyan/50 bg-cyan/5" : "border-border"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-navy">
                                {formatDate(c.date)} · {formatTime(c.time)}
                              </p>
                              {isToday && !c.completed && (
                                <span className="rounded-full bg-cyan px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                  Today
                                </span>
                              )}
                            </div>
                            {c.notes && (
                              <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>
                            )}
                            {c.assignedRepName && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Rep: {c.assignedRepName}
                              </p>
                            )}
                            <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                              Status:{" "}
                              <span className={c.completed ? "text-green" : "text-muted-foreground"}>
                                {c.completed ? "Completed" : "Pending"}
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <label className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-navy">
                              <input
                                type="checkbox"
                                checked={!!c.completed}
                                onChange={() => void handleToggleCallComplete(c)}
                                className="h-3.5 w-3.5 rounded border-border text-green-600 focus:ring-green-500"
                              />
                              Complete
                            </label>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-navy"
                              title="Edit call"
                              onClick={() => {
                                setEditingCall(c);
                                setOpenCall(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Card>

          {/* Feasibility Call */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-1.5 text-xl font-bold text-foreground">Feasibility Call</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              Capture notes, map business components, and generate a preparer-ready summary — all in one guided workflow.
            </p>
            <div className="flex flex-col gap-2.5">
              <Button
                className="w-full"
                disabled={!introCallCompleted}
                onClick={() =>
                  navigate({
                    to: "/clients/$id/feasibility-call",
                    params: { id },
                    search: { callId: "new" },
                  })
                }
              >
                Start Feasibility Call
              </Button>
              {!introCallCompleted && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="h-3 w-3 shrink-0" />
                  Complete the Intro Call to enable
                </p>
              )}
              <Button
                variant="outline"
                className="w-full"
                disabled={!introCallCompleted}
                onClick={() =>
                  navigate({
                    to: "/clients/$id/feasibility-call",
                    params: { id },
                    search: { callId: undefined },
                  })
                }
              >
                View Feasibility Summary
              </Button>
            </div>
          </div>

          {/* Engagements */}
          <Card title="Engagements" id="section-engagements">
            {engagements.length === 0 && lead.taxYears.length === 0 ? (
              <p className="text-sm text-muted-foreground">No engagements yet.</p>
            ) : (
              <>
                <ul className="mb-4 space-y-2">
                  {/* Synthetic row from lead.taxYears when no backend engagements exist */}
                  {engagements.length === 0 && lead.taxYears.length > 0 && (
                    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-gradient-frost p-3 text-sm">
                      <div className="shrink-0">
                        <p className="font-semibold text-navy">R&amp;D Tax Credit</p>
                        <div className="mt-0.5">
                          <StatusBadge status={lead.status} />
                        </div>
                      </div>
                      <YearChips years={lead.taxYears} />
                    </li>
                  )}
                  {engagements.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-gradient-frost p-3 text-sm"
                    >
                      <div className="shrink-0">
                        <p className="font-semibold text-navy">{e.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.phase} · {e.status}
                        </p>
                      </div>
                      <YearChips years={e.years} />
                    </li>
                  ))}
                </ul>
                {engagements.length > 0 && <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan">
                    R&amp;D Tax Credit — {engagementYears.length ? engagementYears.join(", ") : "—"}
                  </p>
                  <div className="mt-2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 230)" />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                          fontSize={11}
                          stroke="oklch(0.50 0.03 245)"
                        />
                        <YAxis
                          type="category"
                          dataKey="year"
                          fontSize={11}
                          stroke="oklch(0.50 0.03 245)"
                          width={42}
                        />
                        <RTooltip
                          formatter={(v: number) => formatCurrency(v)}
                          cursor={{ fill: "oklch(0.94 0.02 220 / 0.5)" }}
                        />
                        <Bar dataKey="amount" fill="var(--orange)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total engagement value</span>
                    <span className="font-bold text-navy tabular-nums">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>}
              </>
            )}
          </Card>

          {/* Quick action */}
          <Button
            variant="outline"
            className="w-full border-cyan text-cyan hover:bg-cyan/10"
            onClick={() => navigate({ to: "/", search: buildCalculationSearch(lead) as never })}
          >
            <CalcIcon className="mr-1.5 h-4 w-4" /> Open Calculator
          </Button>
        </div>
      </div>

      <ScheduleCallDialog
        clientId={id}
        call={editingCall}
        defaultCallType={
          !editingCall && !calls.some((c) => c.callType === "intro_call")
            ? "Intro Call"
            : undefined
        }
        open={openCall}
        onOpenChange={(o) => {
          setOpenCall(o);
          if (!o) setEditingCall(null);
        }}
      />
      <EditClientDialog lead={lead} open={openEdit} onOpenChange={setOpenEdit} />
    </div>
  );
}


// An editable list of free-text values (emails or phones) — a person has
// one-to-many of each, with no labels. Always keeps at least one row.
function MultiValueField({
  label,
  type = "text",
  placeholder,
  format,
  values,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  format?: (v: string) => string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const update = (i: number, v: string) =>
    onChange(values.map((x, idx) => (idx === i ? (format ? format(v) : v) : x)));
  const removeAt = (i: number) =>
    onChange(values.length > 1 ? values.filter((_, idx) => idx !== i) : [""]);
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type={type}
              value={v}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${label}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 h-7 px-2 text-xs"
        onClick={() => onChange([...values, ""])}
      >
        <Plus className="mr-1 h-3 w-3" /> Add another
      </Button>
    </div>
  );
}

function Card({
  title,
  children,
  action,
  id,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card shadow-card"
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-navy">
        {icon}
        {value}
      </p>
    </div>
  );
}

// ─── R&D Tax Credit History ───────────────────────────────────────────────────

const YEAR_STATUS_META: Record<
  TaxYearStatus,
  { label: string; cardCls: string; icon: React.ReactNode }
> = {
  current: {
    label: "Current year",
    cardCls: "bg-navy/8 border-navy/30 text-navy",
    icon: <Star className="h-3.5 w-3.5" />,
  },
  current_engaged: {
    label: "Current year",
    cardCls: "bg-green/10 border-green/50 text-green ring-1 ring-green/30",
    icon: <Star className="h-3.5 w-3.5" />,
  },
  engaged: {
    label: "Engaged",
    cardCls: "bg-green/10 border-green/50 text-green",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  eligible_not_engaged: {
    label: "Eligible — not engaged",
    cardCls: "bg-card border-border text-muted-foreground",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  not_eligible: {
    label: "Not eligible",
    cardCls: "bg-muted/40 border-border text-muted-foreground opacity-60",
    icon: <Ban className="h-3.5 w-3.5" />,
  },
};

function TaxHistoryPanel({
  lead,
  onUpdate,
}: {
  lead: import("@/types/crm").Lead;
  onUpdate: (yearStatuses: Record<string, TaxYearRecord>) => Promise<void>;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - i);
  const saved = lead.data?.yearStatuses ?? {};

  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [pendingChange, setPendingChange] = useState<{ year: number; status: TaxYearStatus } | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function effectiveRecord(year: number): TaxYearRecord {
    if (saved[year]) return saved[year];
    if (year === currentYear) {
      const isEngaged = lead.taxYears.includes(year as import("@/types/crm").TaxYear);
      return { status: isEngaged ? "current_engaged" : "current" };
    }
    // Any year listed in the client's Engagement Years is Engaged
    if (lead.taxYears.includes(year as import("@/types/crm").TaxYear))
      return { status: "engaged" };
    return { status: "eligible_not_engaged" };
  }

  const records = years.map((y) => ({ year: y, record: effectiveRecord(y) }));
  const engagedCount = records.filter((r) => r.record.status === "engaged" || r.record.status === "current_engaged").length;
  const openCount = records.filter((r) => r.record.status === "eligible_not_engaged").length;
  const notEligibleCount = records.filter((r) => r.record.status === "not_eligible").length;

  const applyStatus = async (year: number, status: TaxYearStatus, reason?: string) => {
    setSaving(true);
    const record: TaxYearRecord = { status };
    if (status === "not_eligible") {
      record.notEligibleReason = reason ?? "";
      record.notEligibleBy = lead.rep;
      record.notEligibleAt = new Date().toISOString();
    } else if (reason) {
      record.changeNote = reason;
      record.changedBy = lead.rep;
      record.changedAt = new Date().toISOString();
    }
    try {
      await onUpdate({ ...saved, [year]: record });
      setActiveYear(null);
    } catch {
      toast.error("Failed to save year status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card shadow-card"
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-navy">R&amp;D Tax Credit History</h2>
      </header>
      <div className="p-5">
        {/* Summary KPIs */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { label: "Years Engaged", value: engagedCount, cls: "text-green" },
            { label: "Open Opportunities", value: openCount, cls: "text-orange" },
            { label: "Not Eligible", value: notEligibleCount, cls: "text-muted-foreground" },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-center"
            >
              <p className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Year cards */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {records.map(({ year, record }) => {
            const meta = YEAR_STATUS_META[record.status];
            return (
              <button
                key={year}
                type="button"
                title={
                  record.status === "not_eligible" && record.notEligibleReason
                    ? `Reason: ${record.notEligibleReason}\nBy: ${record.notEligibleBy} · ${record.notEligibleAt ? new Date(record.notEligibleAt).toLocaleString() : ""}`
                    : record.changeNote
                    ? `Note: ${record.changeNote}\nBy: ${record.changedBy} · ${record.changedAt ? new Date(record.changedAt).toLocaleString() : ""}`
                    : undefined
                }
                onClick={() => setActiveYear(activeYear === year ? null : year)}
                className={cn(
                  "flex flex-col items-center rounded-xl border px-2 py-3 text-center transition-all hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                  meta.cardCls,
                  activeYear === year && "ring-2 ring-cyan",
                )}
              >
                {record.status === "current_engaged" ? (
                  <>
                    <span className="mb-1 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-lg font-bold leading-none">{year}</span>
                    <span className="mt-1.5 text-[10px] leading-tight">Current year</span>
                    <span className="mt-0.5 text-[10px] leading-tight font-semibold">Engaged</span>
                  </>
                ) : (
                  <>
                    <span className="mb-1">{meta.icon}</span>
                    <span className="text-lg font-bold leading-none">{year}</span>
                    <span className="mt-1.5 text-[10px] leading-tight">{meta.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Inline status picker */}
        {activeYear !== null && (
          <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Set status for {activeYear}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeYear === currentYear && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => { setPendingChange({ year: activeYear, status: "current" }); setReasonDraft(""); }}
                >
                  <Star className="mr-1.5 h-3.5 w-3.5" /> Current Year
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                className="border-green/50 text-green hover:bg-green/10"
                onClick={() => { setPendingChange({ year: activeYear, status: "engaged" }); setReasonDraft(""); }}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Engaged
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => { setPendingChange({ year: activeYear, status: "eligible_not_engaged" }); setReasonDraft(""); }}
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" /> Eligible – Not Engaged
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                className="text-muted-foreground"
                onClick={() => { setPendingChange({ year: activeYear, status: "not_eligible" }); setReasonDraft(""); }}
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" /> Not Eligible…
              </Button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3">
          {(Object.entries(YEAR_STATUS_META) as [TaxYearStatus, (typeof YEAR_STATUS_META)[TaxYearStatus]][])
            .filter(([status]) => status !== "current_engaged")
            .map(([status, { label, icon }]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {icon}
                {label}
              </div>
            ))}
        </div>
      </div>

      {/* Status-change reason dialog — shown for every year status change */}
      <Dialog
        open={pendingChange !== null}
        onOpenChange={(open) => { if (!open) setPendingChange(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change status for {pendingChange?.year}
            </DialogTitle>
            <DialogDescription>
              {pendingChange?.status === "not_eligible"
                ? "Provide a reason below. Your name, date, and time will be automatically recorded."
                : "Optionally add a note explaining this status change."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            placeholder={
              pendingChange?.status === "not_eligible"
                ? "e.g. Client did not perform qualifying R&D activities this year…"
                : "e.g. Reason for this status change…"
            }
            className="min-h-[88px]"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingChange(null)}>
              Cancel
            </Button>
            <Button
              disabled={(pendingChange?.status === "not_eligible" && !reasonDraft.trim()) || saving}
              onClick={async () => {
                if (pendingChange !== null) {
                  await applyStatus(pendingChange.year, pendingChange.status, reasonDraft.trim() || undefined);
                  setPendingChange(null);
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}

