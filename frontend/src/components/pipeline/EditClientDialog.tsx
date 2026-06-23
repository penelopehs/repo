// Edit Client modal â€” full client fields, writes back through leadsStore.

import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
import type {
  Lead,
  LeadDataEntity,
  LeadSource,
  LeadStatus,
  SalesRep,
  TaxYear,
  TaxYearRecord,
} from "@/types/crm";
import { PIPELINE_STAGES, SELECTABLE_TAX_YEARS } from "@/types/crm";
import { useLeadsStore } from "@/store/leadsStore";
import { useUsersStore } from "@/store/usersStore";
import { userFullName } from "@/services/users";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { renameEntityInCalculations } from "@/store/calculatorStore";

const SOURCES: LeadSource[] = [
  "Referral",
  "Website",
  "Cold Call",
  "Conference",
  "LinkedIn",
  "Partner",
  "Other",
];
const STATUSES: { value: LeadStatus; label: string }[] = PIPELINE_STAGES;

const schema = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    company: z.string().trim().min(1).max(160),
    // Email and phone are each optional on their own, but at least one is
    // required â€” enforced in the superRefine below.
    email: z.string().trim().max(255),
    phone: z.string().trim().max(40),
    source: z.enum([
      "Referral",
      "Website",
      "Cold Call",
      "Conference",
      "LinkedIn",
      "Partner",
      "Other",
    ]),
    status: z.enum([
      "new_lead",
      "intro_call",
      "feasibility_call",
      "tax_preparer_coordination",
      "closed",
    ]),
    taxYears: z.array(z.number().int()).min(1, "Select at least one engagement year"),
    entityNames: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
    // Optional assignments â€” users.iduser as a string ("" = unassigned).
    salesManager: z.string().optional(),
    trainingManager: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasEmail = data.email.length > 0;
    const hasPhone = data.phone.length > 0;
    if (!hasEmail && !hasPhone) {
      const message = "Email or phone required";
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message });
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message });
      return;
    }
    if (hasEmail && !z.string().email().safeParse(data.email).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Invalid email" });
    }
    if (hasPhone && data.phone.length < 7) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Invalid phone" });
    }
  });

// Sentinel SelectItem value for "no assignment" (Radix forbids empty values).
const UNASSIGNED = "unassigned";

interface Props {
  lead: Lead;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export function EditClientDialog({ lead, trigger, open: openProp, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const update = useLeadsStore((s) => s.updateLead);
  const users = useUsersStore((s) => s.users);
  const ensureUsers = useUsersStore((s) => s.ensureLoaded);

  useEffect(() => {
    void ensureUsers();
  }, [ensureUsers]);

  const buildForm = () => ({
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    // Track the assigned rep by users.iduser (as a string) so it can be changed
    // and round-tripped through the update endpoint (repId â†’ salesperson_iduser).
    rep: lead.repId != null ? String(lead.repId) : "",
    status: lead.status,
    taxYears: lead.taxYears ?? [],
    entityNames: (lead.entityNames ?? []).join(",\n"),
    notes: lead.notes ?? "",
    salesManager: lead.salesManagerId != null ? String(lead.salesManagerId) : "",
    trainingManager: lead.trainingManagerId != null ? String(lead.trainingManagerId) : "",
  });

  const [form, setForm] = useState(buildForm);

  useEffect(() => {
    setForm(buildForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form for errors.");
      return;
    }
    setSubmitting(true);
    try {
      // company, entities and tax years live in the `data` blob (the PATCH
      // endpoint has no top-level columns for them). Rebuild it from the form,
      // preserving people and any existing per-year calculation buckets.
      const base = lead.data ?? { people: [], entities: [], calculations: {}, yearStatuses: {} };
      const company = parsed.data.company.trim();
      // The "Company / Entity" field edits the first entity in the list (by
      // position). A rename updates that entity in place — keeping its id and
      // people links — instead of appending a new one.
      const firstEntity = (base.entities ?? [])[0];
      const oldCompany = firstEntity?.name?.trim() ?? "";
      const companyRenamed = !!oldCompany && !!company && oldCompany !== company;
      // Additional entities come from the textarea. Exclude the company name —
      // both its new value and the old one being replaced — so the first entity
      // is never duplicated back into the list.
      const extraEntities = (parsed.data.entityNames ?? "")
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((n) => n !== company && n !== oldCompany);
      // Rebuild the entity list, preserving each entity's stable id (and thus its
      // people links) by matching on name; the first entity is matched by
      // position so renaming it keeps its id. New names get a fresh id.
      const byName = new Map((base.entities ?? []).map((e) => [e.name, e] as const));
      const usedIds = new Set((base.entities ?? []).map((e) => e.id));
      const newEntityId = () => {
        let id = `e_${Date.now().toString(36)}`;
        for (let n = 2; usedIds.has(id); n++) id = `e_${Date.now().toString(36)}_${n}`;
        usedIds.add(id);
        return id;
      };
      const entities: LeadDataEntity[] = [];
      if (company) {
        entities.push(
          firstEntity ? { ...firstEntity, name: company } : { id: newEntityId(), name: company },
        );
      }
      for (const name of extraEntities) {
        const existing = byName.get(name);
        entities.push(existing ? { ...existing, name } : { id: newEntityId(), name });
      }
      // Drop people-links for entities that were removed in this edit.
      const keptIds = new Set(entities.map((e) => e.id));
      const entityPeople = Object.fromEntries(
        Object.entries(base.entityPeople ?? {}).filter(([entityId]) => keptIds.has(entityId)),
      );
      // Each tax year keeps its own calculation (an entity array). Preserve any
      // existing bucket; default new years to an empty array for the calculator
      // to seed from the entity list on first open.
      const calculations: Record<string, unknown> = {};
      const yearStatuses: Record<string, TaxYearRecord> = {};
      for (const y of form.taxYears) {
        calculations[String(y)] = base.calculations[String(y)] ?? {};
        // Carry over an existing per-year status; years without one are left
        // unset (consumers fall back to a default), and statuses for tax years
        // removed in this edit are dropped.
        const existing = base.yearStatuses?.[String(y)];
        if (existing) yearStatuses[String(y)] = existing;
      }
      // Propagate a company rename into every year's saved calculation, which
      // keys entities by companyName (not id).
      const renamedCalculations = companyRenamed
        ? renameEntityInCalculations(calculations, oldCompany, company)
        : calculations;
      // Keep initialEntities in sync: add new entities, apply renames, drop
      // removed ones — so the calculator always sees the current entity list.
      const initialById = new Map((base.initialEntities ?? []).map((e) => [e.id, e]));
      const initialEntities = entities.map((e) =>
        initialById.has(e.id) ? { ...initialById.get(e.id)!, name: e.name } : e,
      );
      const data = {
        ...base,
        entities,
        initialEntities,
        calculations: renamedCalculations,
        entityPeople,
        yearStatuses,
      };

      await update(lead.id, {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        source: parsed.data.source,
        status: parsed.data.status,
        notes: parsed.data.notes,
        repId: form.rep ? Number(form.rep) : null,
        salesManagerId: parsed.data.salesManager ? Number(parsed.data.salesManager) : null,
        trainingManagerId: parsed.data.trainingManager ? Number(parsed.data.trainingManager) : null,
        data,
      });
      toast.success("Client updated", {
        description: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
      });
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't update client", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-navy flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edit Client
          </DialogTitle>
          <DialogDescription>
            Update lead details. Changes propagate to pipeline tables and KPIs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Item label="First Name">
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Item>
            <Item label="Last Name">
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Item>
            <Item label="Company / Entity">
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </Item>
            <Item label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Item>
            <Item label="Phone">
              <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </Item>
            <Item label="Lead Source">
              <Select
                value={form.source}
                onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Item>
            <Item label="Assigned Sales Rep">
              <Select
                value={form.rep || UNASSIGNED}
                onValueChange={(v) => setForm({ ...form, rep: v === UNASSIGNED ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.iduser} value={String(u.iduser)}>
                      {userFullName(u) || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Item>
            <Item label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Item>
          </div>
          <Item label="Engagement Years">
            <MultiYearSelect
              value={form.taxYears}
              onToggle={(year: TaxYear) =>
                setForm((prev) => ({
                  ...prev,
                  taxYears: prev.taxYears.includes(year)
                    ? prev.taxYears.filter((item) => item !== year)
                    : [...prev.taxYears, year].sort((a, b) => a - b),
                }))
              }
              onSelectAll={() => setForm((prev) => ({ ...prev, taxYears: [...SELECTABLE_TAX_YEARS] }))}
              onClear={() => setForm((prev) => ({ ...prev, taxYears: [] }))}
            />
          </Item>

          <Item label="Existing Notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Item>

          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Optional Assignments
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Item optional label="Sales Manager">
              <Select
                value={form.salesManager || UNASSIGNED}
                onValueChange={(v) => setForm({ ...form, salesManager: v === UNASSIGNED ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.iduser} value={String(u.iduser)}>
                      {userFullName(u) || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Item>

            <Item optional label="Training Manager">
              <Select
                value={form.trainingManager || UNASSIGNED}
                onValueChange={(v) =>
                  setForm({ ...form, trainingManager: v === UNASSIGNED ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.iduser} value={String(u.iduser)}>
                      {userFullName(u) || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Item>
          </div>

          <DialogFooter>
            <Button
              disabled={submitting}
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={submitting}
              type="submit"
              className="bg-orange text-white hover:bg-orange/90"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Item({
  optional = false,
  label,
  children,
}: {
  optional?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">
        {label}
        {optional && (
          <span className="text-muted-foreground ml-2 text-xs font-normal">optional</span>
        )}
      </Label>
      {children}
    </div>
  );
}
