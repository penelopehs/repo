// View Profile page — client overview with engagements, contacts, calls, intake.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Briefcase,
  Mail,
  Phone,
  Plus,
  Users,
  Layers,
  CalendarClock,
  BadgeCheck,
  X,
  Pencil,
  Trash2,
  Calculator as CalcIcon,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KpiCard } from "@/components/KpiCard";
import { YearChips } from "@/components/MultiYearSelect";
import { StatusBadge } from "@/components/pipeline/StatusBadge";
import { useLeadsStore } from "@/store/leadsStore";
import { useEngagementsStore } from "@/store/engagementsStore";
import { ScheduleCallDialog } from "@/components/profile/ScheduleCallDialog";
import { EditClientDialog } from "@/components/pipeline/EditClientDialog";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";

export function ProfilePage({ id }: { id: string }) {
  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === id));
  const updateLead = useLeadsStore((s) => s.updateLead);
  const byClient = useEngagementsStore((s) => s.byClient);
  const addContact = useEngagementsStore((s) => s.addContact);
  const updateContact = useEngagementsStore((s) => s.updateContact);
  const deleteContact = useEngagementsStore((s) => s.deleteContact);
  const updateCall = useEngagementsStore((s) => s.updateCall);
  const navigate = useNavigate();
  const [openCall, setOpenCall] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [isEditingIntakeNotes, setIsEditingIntakeNotes] = useState(false);
  const [draftIntakeNote, setDraftIntakeNote] = useState("");
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    role: "",
    workEmail: "",
    email: "",
    workPhone: "",
    mobilePhone: "",
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
  const saveTimerRef = useRef<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const { engagements, contacts, entities: clientEntities, calls } = byClient(id);

  useEffect(() => {
    const now = new Date();
    calls.forEach((c) => {
      if (!c.completed && new Date(`${c.date}T${c.time}`) < now) {
        updateCall(c.id, { completed: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls.length, updateCall]);

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

  if (!lead) {
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

      <div className="rounded-[18px] border border-[#e2e8f0] bg-white p-6 sm:p-7 shadow-[0_2px_8px_rgba(0,0,0,0.05)] mb-5 flex flex-wrap items-start justify-between gap-5">
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
            <div className="mt-3">
              <StatusBadge status={lead.status} />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            {
              label: "Total Entities",
              value: clientEntities.length,
              icon: Layers,
              accent: "navy",
              target: "section-entities",
            },
            {
              label: "Total Contacts",
              value: contacts.length,
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
          {/* General Info */}
          <Card title="General Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Lead Source" value={lead.source} />
              <Info
                label="Client Since"
                value={lead.engagedSince ? formatDate(lead.engagedSince) : formatDate(lead.addedAt)}
              />
              <Info label="Phone" value={lead.phone} icon={<Phone className="h-3 w-3" />} />
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
              <p className="text-sm text-muted-foreground">
                Add intake notes or comments for this client profile. These will be saved on the
                profile and displayed as individual notes.
              </p>
              {isEditingIntakeNotes ? (
                <>
                  <Textarea
                    value={draftIntakeNote}
                    onChange={(event) => setDraftIntakeNote(event.target.value)}
                    className="min-h-[140px]"
                    rows={6}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        if (!draftIntakeNote.trim()) return;
                        if (editingNoteId) {
                          // update existing note
                          updateLead(id, {
                            intakeNotes: (lead?.intakeNotes ?? []).map((n) =>
                              n.id === editingNoteId ? { ...n, text: draftIntakeNote.trim() } : n,
                            ),
                          });
                        } else {
                          // add new note
                          updateLead(id, {
                            intakeNotes: [
                              ...(lead?.intakeNotes ?? []),
                              {
                                id: `note_${Date.now()}`,
                                text: draftIntakeNote.trim(),
                                createdAt: new Date().toISOString(),
                                author: lead?.rep,
                              },
                            ],
                          });
                        }
                        // ensure localStorage updated immediately (fixes intermittent hydration overwrite)
                        try {
                          if (typeof window !== "undefined") {
                            window.localStorage.setItem(
                              "sales-leads",
                              JSON.stringify(useLeadsStore.getState().leads),
                            );
                          }
                        } catch (e) {
                          console.warn("Failed to persist leads after save:", e);
                        }
                        // show transient saved indicator
                        setNoteSaved(true);
                        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
                        saveTimerRef.current = window.setTimeout(() => setNoteSaved(false), 2500);
                        setDraftIntakeNote("");
                        setIsEditingIntakeNotes(false);
                        setEditingNoteId(null);
                      }}
                      disabled={draftIntakeNote.trim().length === 0}
                    >
                      Save notes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraftIntakeNote("");
                        setIsEditingIntakeNotes(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {lead.intakeNotes && lead.intakeNotes.length > 0 ? (
                    <div className="space-y-3">
                      {lead.intakeNotes.map((note) => (
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
                                {formatDate(note.createdAt)}{" "}
                                <span className="text-cyan">
                                  {new Date(note.createdAt).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setIsEditingIntakeNotes(true);
                                    setDraftIntakeNote(note.text);
                                    setEditingNoteId(note.id);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() => {
                                    if (!window.confirm("Delete this note?")) return;
                                    updateLead(id, {
                                      intakeNotes: (lead?.intakeNotes ?? []).filter(
                                        (n) => n.id !== note.id,
                                      ),
                                    });
                                    try {
                                      if (typeof window !== "undefined") {
                                        window.localStorage.setItem(
                                          "sales-leads",
                                          JSON.stringify(useLeadsStore.getState().leads),
                                        );
                                      }
                                    } catch (e) {
                                      console.warn("Failed to persist leads after delete:", e);
                                    }
                                    setNoteSaved(true);
                                    if (saveTimerRef.current)
                                      window.clearTimeout(saveTimerRef.current);
                                    saveTimerRef.current = window.setTimeout(
                                      () => setNoteSaved(false),
                                      2500,
                                    );
                                    if (editingNoteId === note.id) {
                                      setEditingNoteId(null);
                                      setIsEditingIntakeNotes(false);
                                      setDraftIntakeNote("");
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                          <p>{note.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="min-h-[96px] rounded-xl border border-border bg-muted/30 p-4 text-sm text-navy">
                      No intake notes yet.
                    </div>
                  )}
                  <Button onClick={() => setIsEditingIntakeNotes(true)}>
                    {lead.intakeNotes && lead.intakeNotes.length > 0
                      ? "Add another note"
                      : "Add note"}
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Entities */}
          <Card title="Entities" id="section-entities">
            <div className="overflow-x-auto">
              {(() => {
                const leadEntityNames = (lead.entityNames ?? []).filter(Boolean);
                const mergedEntities = [
                  ...clientEntities,
                  ...leadEntityNames
                    .filter((name) => !clientEntities.some((e) => e.name === name))
                    .map((name, i) => ({
                      id: `lead-${i}`,
                      clientId: id,
                      name,
                      ein: "",
                      contacts: [],
                    })),
                ];
                const pocContacts = contacts.filter((c) => c.role === "Point of Contact");
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Entity Name</th>
                        <th className="px-4 py-3">EIN</th>
                        <th className="px-4 py-3">Associated Contacts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedEntities.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-sm text-muted-foreground"
                          >
                            No entities recorded.
                          </td>
                        </tr>
                      ) : (
                        mergedEntities.map((e) => (
                          <tr key={e.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-medium text-navy">{e.name}</td>
                            <td className="px-4 py-3 tabular-nums text-muted-foreground">
                              {e.ein || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {pocContacts.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  pocContacts.map((c) => (
                                    <Badge
                                      key={c.id}
                                      variant="outline"
                                      className="border-cyan/40 text-navy"
                                    >
                                      {c.firstName} {c.lastName}
                                      <span className="ml-1 text-[10px] text-muted-foreground">
                                        (Point of Contact)
                                      </span>
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
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
          {/* Sales Rep */}
          <Card title="Assigned Sales Representative">
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
          </Card>

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
                    ? "Update this contact details."
                    : "Add a contact for this client. All fields are required before you can save."}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="contact-work-email">Work Email</Label>
                      <Input
                        id="contact-work-email"
                        type="email"
                        value={contactForm.workEmail}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, workEmail: e.target.value }))
                        }
                        placeholder="jane@company.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-email">Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="jane@personal.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="contact-work-phone">Work Phone</Label>
                      <Input
                        id="contact-work-phone"
                        value={contactForm.workPhone}
                        onChange={(e) =>
                          setContactForm((prev) => ({
                            ...prev,
                            workPhone: formatPhone(e.target.value),
                          }))
                        }
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-mobile-phone">Mobile Phone</Label>
                      <Input
                        id="contact-mobile-phone"
                        value={contactForm.mobilePhone}
                        onChange={(e) =>
                          setContactForm((prev) => ({
                            ...prev,
                            mobilePhone: formatPhone(e.target.value),
                          }))
                        }
                        placeholder="(555) 987-6543"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      const trimmed = {
                        firstName: contactForm.firstName.trim(),
                        lastName: contactForm.lastName.trim(),
                        role: contactForm.role.trim(),
                        workEmail: contactForm.workEmail.trim(),
                        email: contactForm.email.trim(),
                        workPhone: contactForm.workPhone.trim(),
                        mobilePhone: contactForm.mobilePhone.trim(),
                      };

                      if (!trimmed.firstName || !trimmed.lastName || !trimmed.role) {
                        setContactError("First name, last name, and role are required.");
                        return;
                      }

                      if (editingContactId) {
                        updateContact(editingContactId, trimmed);
                      } else {
                        addContact({ clientId: id, ...trimmed });
                      }

                      setContactForm({
                        firstName: "",
                        lastName: "",
                        role: "",
                        workEmail: "",
                        email: "",
                        workPhone: "",
                        mobilePhone: "",
                      });
                      setContactError("");
                      setContactSaved(true);
                      window.setTimeout(() => setContactSaved(false), 2500);
                      setEditingContactId(null);
                      setIsAddingContact(false);
                    }}
                  >
                    {editingContactId ? "Update Contact" : "Save Contact"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setContactForm({
                        firstName: "",
                        lastName: "",
                        role: "",
                        workEmail: "",
                        email: "",
                        workPhone: "",
                        mobilePhone: "",
                      });
                      setContactError("");
                      setEditingContactId(null);
                      setIsAddingContact(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {editingContactId && (
                  <div className="mt-4 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                      onClick={() => {
                        deleteContact(editingContactId);
                        setContactForm({
                          firstName: "",
                          lastName: "",
                          role: "",
                          workEmail: "",
                          email: "",
                          workPhone: "",
                          mobilePhone: "",
                        });
                        setContactError("");
                        setEditingContactId(null);
                        setIsAddingContact(false);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove Contact
                    </Button>
                  </div>
                )}
              </div>
            )}
            <ul className="space-y-3">
              {contacts.length === 0 && (
                <li className="text-sm text-muted-foreground">No contacts.</li>
              )}
              {[...contacts]
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
                      {c.workEmail && (
                        <p className="flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-cyan" />
                          <span className="text-muted-foreground">Work:</span> {c.workEmail}
                        </p>
                      )}
                      {c.email && (
                        <p className="flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-cyan" />
                          <span className="text-muted-foreground">Email:</span> {c.email}
                        </p>
                      )}
                      {c.workPhone && (
                        <p className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-cyan" />
                          <span className="text-muted-foreground">Work:</span> {c.workPhone}
                        </p>
                      )}
                      {c.mobilePhone && (
                        <p className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-cyan" />
                          <span className="text-muted-foreground">Mobile:</span> {c.mobilePhone}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setContactForm({
                            firstName: c.firstName,
                            lastName: c.lastName,
                            role: c.role,
                            workEmail: c.workEmail,
                            email: c.email,
                            workPhone: c.workPhone,
                            mobilePhone: c.mobilePhone,
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

          {/* Engagements */}
          <Card title="Engagements" id="section-engagements">
            {engagements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No engagements yet.</p>
            ) : (
              <>
                <ul className="mb-4 space-y-2">
                  {engagements.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-gradient-frost p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-navy">{e.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.phase} · {e.status}
                        </p>
                      </div>
                      <YearChips years={e.years} />
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg border border-border bg-card p-3">
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
                </div>
              </>
            )}
          </Card>

          {/* Follow-up Calls */}
          <Card
            id="section-calls"
            title="Follow-up Calls"
            action={
              <Button size="sm" variant="outline" onClick={() => setOpenCall(true)}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            }
          >
            {calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {[...calls]
                  .sort((a, b) => {
                    if ((a.completed ?? false) !== (b.completed ?? false))
                      return Number(a.completed ?? false) - Number(b.completed ?? false);
                    return (
                      new Date(`${a.date}T${a.time}`).getTime() -
                      new Date(`${b.date}T${b.time}`).getTime()
                    );
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
                            <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                              Status:{" "}
                              <span className={c.completed ? "text-green-600" : "text-amber-600"}>
                                {c.completed ? "Completed" : "Pending"}
                              </span>
                            </p>
                          </div>
                          <label className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-navy">
                            <input
                              type="checkbox"
                              checked={!!c.completed}
                              onChange={() => updateCall(c.id, { completed: !c.completed })}
                              className="h-3.5 w-3.5 rounded border-border text-green-600 focus:ring-green-500"
                            />
                            Complete
                          </label>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Card>

          {/* Quick action */}
          <Button
            variant="outline"
            className="w-full border-cyan text-cyan hover:bg-cyan/10"
            onClick={() => navigate({ to: "/", search: { clientName: lead.company } as never })}
          >
            <CalcIcon className="mr-1.5 h-4 w-4" /> Open Calculator
          </Button>
        </div>
      </div>

      <ScheduleCallDialog clientId={id} open={openCall} onOpenChange={setOpenCall} />
      <EditClientDialog lead={lead} open={openEdit} onOpenChange={setOpenEdit} />
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

function IntakeRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-gradient-frost p-3">
      <span className="text-sm text-navy">{label}</span>
      {value ? (
        <Badge className="bg-green text-green-foreground hover:bg-green">
          <BadgeCheck className="mr-1 h-3 w-3" /> Yes
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          <X className="mr-1 h-3 w-3" /> No
        </Badge>
      )}
    </div>
  );
}
