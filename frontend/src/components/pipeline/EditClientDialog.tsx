// Edit Client modal — full client fields, writes back through leadsStore.

import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadSource, LeadStatus, SalesRep } from "@/types/crm";
import { useLeadsStore } from "@/store/leadsStore";

const SOURCES: LeadSource[] = ["Referral", "Website", "Cold Call", "Conference", "LinkedIn", "Partner", "Other"];
const REPS: SalesRep[] = ["David Kim", "James Carter", "Sarah Johnson", "Unassigned"];
const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "calculation_sent", label: "Calculation Sent" },
  { value: "sow_signed", label: "SOW Signed" },
  { value: "active_engagement", label: "Active Engagement" },
  { value: "lost", label: "Lost" },
];

const schema = z.object({
  fullName: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(40),
  source: z.enum(["Referral", "Website", "Cold Call", "Conference", "LinkedIn", "Partner", "Other"]),
  rep: z.enum(["David Kim", "James Carter", "Sarah Johnson", "Unassigned"]),
  status: z.enum(["new", "calculation_sent", "sow_signed", "active_engagement", "lost"]),
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

  const [form, setForm] = useState({
    fullName: lead.fullName,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    rep: lead.rep,
    status: lead.status,
    notes: lead.notes ?? "",
  });

  useEffect(() => {
    setForm({
      fullName: lead.fullName, company: lead.company, email: lead.email, phone: lead.phone,
      source: lead.source, rep: lead.rep, status: lead.status, notes: lead.notes ?? "",
    });
  }, [lead]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error("Please check the form for errors.");
      return;
    }
    update(lead.id, parsed.data);
    toast.success("Client updated", { description: form.fullName });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-navy flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Client</DialogTitle>
          <DialogDescription>Update lead details. Changes propagate to pipeline tables and KPIs.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Item label="Full Name"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Item>
            <Item label="Company / Entity"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Item>
            <Item label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Item>
            <Item label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Item>
            <Item label="Lead Source">
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Item>
            <Item label="Assigned Sales Rep">
              <Select value={form.rep} onValueChange={(v) => setForm({ ...form, rep: v as SalesRep })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </Item>
            <Item label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Item>
          </div>
          <Item label="Existing Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Item>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-navy text-navy-foreground hover:bg-navy/90">Save Changes</Button>
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
