// View Profile page — client overview with engagements, contacts, calls, intake.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft, Briefcase, Mail, Phone, Plus, Users, Layers, CalendarClock, BadgeCheck, X,
  Pencil, Calculator as CalcIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/KpiCard";
import { YearChips } from "@/components/MultiYearSelect";
import { useLeadsStore } from "@/store/leadsStore";
import { useEngagementsStore } from "@/store/engagementsStore";
import { AddEngagementDialog } from "@/components/profile/AddEngagementDialog";
import { ScheduleCallDialog } from "@/components/profile/ScheduleCallDialog";
import { EditClientDialog } from "@/components/pipeline/EditClientDialog";
import { formatCurrency, formatDate } from "@/utils/format";

export function ProfilePage({ id }: { id: string }) {
  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === id));
  const byClient = useEngagementsStore((s) => s.byClient);
  const navigate = useNavigate();
  const [openEng, setOpenEng] = useState(false);
  const [openCall, setOpenCall] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy">Client not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This client no longer exists.</p>
        <Button className="mt-6" onClick={() => navigate({ to: "/pipeline" })}>Back to Pipeline</Button>
      </div>
    );
  }

  const { engagements, contacts, entities: clientEntities, calls } = byClient(id);

  const chartData = useMemo(() => {
    const map = new Map<number, number>();
    engagements.forEach((e) => e.billing.forEach((b) => map.set(b.year, (map.get(b.year) || 0) + b.amount)));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([year, amount]) => ({ year: String(year), amount }));
  }, [engagements]);

  const engagementYears = useMemo(() => {
    const ys = new Set<number>();
    engagements.forEach((e) => e.years.forEach((y) => ys.add(y)));
    return Array.from(ys).sort();
  }, [engagements]);

  const grandTotal = chartData.reduce((s, r) => s + r.amount, 0);

  const upcomingCalls = calls.filter((c) => new Date(`${c.date}T${c.time}`).getTime() >= Date.now()).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pipeline" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-2">
            <Button className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated" onClick={() => setOpenEng(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New Engagement
            </Button>
            <Button variant="outline" onClick={() => setOpenEdit(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit Client
            </Button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan">Client</p>
          <h1 className="text-2xl font-bold text-navy">{lead.fullName}</h1>
          <p className="text-sm text-muted-foreground">{lead.company}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Entities"    value={clientEntities.length} icon={Layers} accent="navy" />
        <KpiCard label="Total Contacts"    value={contacts.length}       icon={Users}  accent="cyan" />
        <KpiCard label="Total Engagements" value={engagements.length}    icon={Briefcase} accent="orange" />
        <KpiCard label="Upcoming Calls"    value={upcomingCalls}         icon={CalendarClock} accent="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* General Info */}
          <Card title="General Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Lead Source" value={lead.source} />
              <Info label="Client Since" value={lead.engagedSince ? formatDate(lead.engagedSince) : formatDate(lead.addedAt)} />
              <Info label="Phone" value={lead.phone} icon={<Phone className="h-3 w-3" />} />
              <Info label="Email" value={lead.email} icon={<Mail className="h-3 w-3" />} />
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm text-navy">{lead.notes || "No notes yet."}</p>
            </div>
          </Card>

          {/* Intake Questions */}
          <Card title="Intake Questions">
            <div className="grid gap-3 sm:grid-cols-2">
              <IntakeRow label="Multi-state operations" value={!!lead.intake?.multiState} />
              <IntakeRow label="Previous R&D credits" value={!!lead.intake?.priorRdCredits} />
              <IntakeRow label="Government grants / funding" value={!!lead.intake?.governmentGrants} />
              <IntakeRow label="Qualified research expenses" value={!!lead.intake?.qualifiedResearchExpenses} />
            </div>
          </Card>

          {/* Entities */}
          <Card title="Entities">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Entity Name</th>
                    <th className="px-4 py-3">EIN</th>
                    <th className="px-4 py-3">Associated Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {clientEntities.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">No entities recorded.</td></tr>
                  )}
                  {clientEntities.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-navy">{e.name}</td>
                      <td className="px-4 py-3 tabular-nums">{e.ein}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {e.contacts.map((c, i) => (
                            <Badge key={i} variant="outline" className="border-cyan/40 text-navy">
                              {c.name} <span className="ml-1 text-[10px] text-muted-foreground">({c.role})</span>
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Sales Rep */}
          <Card title="Assigned Sales Representative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-navy text-navy-foreground text-sm font-bold">
                {lead.rep.split(" ").map((s) => s[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-navy">{lead.rep}</p>
                <p className="text-xs text-muted-foreground">Senior Sales Representative</p>
              </div>
            </div>
          </Card>

          {/* People & Contacts */}
          <Card title="People & Contacts">
            <ul className="space-y-3">
              {contacts.length === 0 && <li className="text-sm text-muted-foreground">No contacts.</li>}
              {contacts.map((c) => (
                <li key={c.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-navy">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.role}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3 text-cyan" /> {c.email}</p>
                  <p className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-cyan" /> {c.phone}</p>
                </li>
              ))}
            </ul>
          </Card>

          {/* Engagements */}
          <Card
            title="Engagements"
            action={
              <Button size="sm" onClick={() => setOpenEng(true)} className="bg-orange hover:bg-orange/90 text-orange-foreground">
                <Plus className="mr-1 h-3 w-3" /> New
              </Button>
            }
          >
            {engagements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No engagements yet.</p>
            ) : (
              <>
                <ul className="mb-4 space-y-2">
                  {engagements.map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-gradient-frost p-3 text-sm">
                      <div>
                        <p className="font-semibold text-navy">{e.type}</p>
                        <p className="text-xs text-muted-foreground">{e.phase} · {e.status}</p>
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
                      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 230)" />
                        <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} stroke="oklch(0.50 0.03 245)" />
                        <YAxis type="category" dataKey="year" fontSize={11} stroke="oklch(0.50 0.03 245)" width={42} />
                        <RTooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: "oklch(0.94 0.02 220 / 0.5)" }} />
                        <Bar dataKey="amount" fill="var(--orange)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total engagement value</span>
                    <span className="font-bold text-navy tabular-nums">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Follow-up Calls */}
          <Card
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
                {calls.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-semibold text-navy">{formatDate(c.date)} · {c.time}</p>
                    {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
                  </li>
                ))}
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

      <AddEngagementDialog clientId={id} open={openEng} onOpenChange={setOpenEng} />
      <ScheduleCallDialog clientId={id} open={openCall} onOpenChange={setOpenCall} />
      <EditClientDialog lead={lead} open={openEdit} onOpenChange={setOpenEdit} />
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.section
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
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-navy">{icon}{value}</p>
    </div>
  );
}

function IntakeRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-gradient-frost p-3">
      <span className="text-sm text-navy">{label}</span>
      {value ? (
        <Badge className="bg-green text-green-foreground hover:bg-green"><BadgeCheck className="mr-1 h-3 w-3" /> Yes</Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground"><X className="mr-1 h-3 w-3" /> No</Badge>
      )}
    </div>
  );
}
