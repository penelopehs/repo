// "Add New Lead" modal — validated with zod, dispatches to leads store.

import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { LeadSource, SalesRep, TaxYear } from "@/types/crm";
import { useLeadsStore } from "@/store/leadsStore";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { ALL_TAX_YEARS } from "@/types/crm";

const SOURCES: LeadSource[] = ["Referral", "Website", "Cold Call", "Conference", "LinkedIn", "Partner", "Other"];
const REPS: SalesRep[] = ["David Kim", "James Carter", "Sarah Johnson", "Unassigned"];

const schema = z.object({
  fullName: z.string().trim().min(1, "Required").max(120),
  company: z.string().trim().min(1, "Required").max(160),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(7, "Invalid phone").max(40),
  source: z.enum(["Referral", "Website", "Cold Call", "Conference", "LinkedIn", "Partner", "Other"]),
  rep: z.enum(["David Kim", "James Carter", "Sarah Johnson", "Unassigned"]),
});

type FormState = z.infer<typeof schema>;

const initial: FormState = {
  fullName: "", company: "", email: "", phone: "",
  source: "Website", rep: "Unassigned",
};

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initial);
  const [years, setYears] = useState<TaxYear[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const addLead = useLeadsStore((s) => s.addLead);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleYear = (y: TaxYear) =>
    setYears((p) => (p.includes(y) ? p.filter((x) => x !== y) : [...p, y].sort((a, b) => a - b)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] as keyof FormState] = issue.message;
      setErrors(fe);
      return;
    }
    addLead({ ...parsed.data, taxYears: years });
    toast.success("Lead added", { description: `${parsed.data.fullName} · ${parsed.data.company}` });
    setForm(initial);
    setYears([]);
    setErrors({});
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-orange hover:bg-orange/90 text-orange-foreground shadow-elevated">
          <Plus className="mr-1.5 h-4 w-4" /> Add New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-navy">Add New Lead</DialogTitle>
          <DialogDescription>Create a new lead and assign a representative.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name" error={errors.fullName}>
              <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Jane Doe" />
            </Field>
            <Field label="Company / Entity" error={errors.company}>
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Inc." />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@acme.com" />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lead Source">
              <Select value={form.source} onValueChange={(v) => set("source", v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assigned Sales Representative">
              <Select value={form.rep} onValueChange={(v) => set("rep", v as SalesRep)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Engagement Years">
            <MultiYearSelect
              value={years}
              onToggle={toggleYear}
              onSelectAll={() => setYears([...ALL_TAX_YEARS])}
              onClear={() => setYears([])}
            />
          </Field>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-navy text-navy-foreground hover:bg-navy/90">Add Lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
