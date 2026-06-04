// Edit Client modal — full client fields, writes back through leadsStore.

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
import type { Lead, LeadSource, LeadStatus, TaxYear } from "@/types/crm";
import { ALL_TAX_YEARS } from "@/types/crm";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { useLeadsStore } from "@/store/leadsStore";

const SOURCES: LeadSource[] = [
  "Referral",
  "Website",
  "Cold Call",
  "Conference",
  "LinkedIn",
  "Partner",
  "Other",
];
const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "calculation_sent", label: "Calculation Sent" },
  { value: "sow_signed", label: "SOW Signed" },
  { value: "active_engagement", label: "Active Engagement" },
  { value: "lost", label: "Lost" },
];

const schema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  company: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(40),
  source: z.enum([
    "Referral",
    "Website",
    "Cold Call",
    "Conference",
    "LinkedIn",
    "Partner",
    "Other",
  ]),
  status: z.enum(["new", "calculation_sent", "sow_signed", "active_engagement", "lost"]),
  taxYears: z.array(z.number().int()).optional(),
  entityNames: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

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

  const buildForm = () => ({
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    rep: lead.rep,
    status: lead.status,
    taxYears: lead.taxYears ?? [],
    entityNames: (lead.entityNames ?? []).join(",\n"),
    notes: lead.notes ?? "",
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
      toast.error("Please check the form for errors.");
      return;
    }
    setSubmitting(true);
    try {
      // company, entities and tax years live in the `data` blob (the PATCH
      // endpoint has no top-level columns for them). Rebuild it from the form,
      // preserving people and any existing per-year calculation buckets.
      const base = lead.data ?? { people: [], entities: [], calculations: {} };
      const company = parsed.data.company.trim();
      const extraEntities = (parsed.data.entityNames ?? "")
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((n) => n !== company);
      const entities = (company ? [company, ...extraEntities] : extraEntities).map((name) => ({
        name,
      }));
      const calculations: Record<string, Record<string, unknown>> = {};
      for (const y of form.taxYears) {
        calculations[String(y)] = base.calculations[String(y)] ?? {};
      }
      const data = { ...base, entities, calculations };

      await update(lead.id, {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        source: parsed.data.source,
        status: parsed.data.status,
        notes: parsed.data.notes,
        data,
      });
      toast.success("Client updated", {
        description: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
      });
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't update client", { description: err instanceof Error ? err.message : undefined });
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
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
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
              <Select value={form.rep || "Unassigned"} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={form.rep || "Unassigned"}>
                    {form.rep || "Unassigned"}
                  </SelectItem>
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
              onSelectAll={() => setForm((prev) => ({ ...prev, taxYears: [...ALL_TAX_YEARS] }))}
              onClear={() => setForm((prev) => ({ ...prev, taxYears: [] }))}
            />
          </Item>
          <Item label="Entity / Entities (one per line)">
            <Textarea
              rows={Math.max(3, form.entityNames.split("\n").length + 1)}
              value={form.entityNames}
              onChange={(e) => {
                const val = e.target.value;
                const first = val.split(/[,\n]/)[0]?.trim() ?? "";
                setForm({ ...form, entityNames: val, company: first || form.company });
              }}
              placeholder={"Acme LLC,\nNorthwind Holdings"}
            />
          </Item>
          <Item label="Existing Notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Item>
          <DialogFooter>
            <Button disabled={submitting} type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={submitting} type="submit" className="bg-orange text-white hover:bg-orange/90">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
