// Add Engagement modal — Type, Status, Phase, multi-year, billing by year.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { EngagementType, EngagementStatus, EngagementPhase, TaxYear } from "@/types/crm";
import { ALL_TAX_YEARS } from "@/types/crm";
import { MultiYearSelect } from "@/components/MultiYearSelect";
import { useEngagementsStore } from "@/store/engagementsStore";
import { formatCurrency } from "@/utils/format";

const TYPES: EngagementType[] = ["R&D Tax Credit", "Cost Segregation", "ERC", "Other"];
const STATUSES: EngagementStatus[] = ["Draft", "Active", "Completed", "On Hold"];
const PHASES: EngagementPhase[] = ["Intake", "Calculation", "Review", "Filed"];

interface Props {
  clientId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function AddEngagementDialog({ clientId, open, onOpenChange }: Props) {
  const add = useEngagementsStore((s) => s.addEngagement);
  const [type, setType] = useState<EngagementType>("R&D Tax Credit");
  const [status, setStatus] = useState<EngagementStatus>("Draft");
  const [phase, setPhase] = useState<EngagementPhase>("Intake");
  const [years, setYears] = useState<TaxYear[]>([2025]);
  const [amounts, setAmounts] = useState<Record<number, number>>({ 2025: 10000 });

  const toggle = (y: TaxYear) =>
    setYears((p) => {
      if (p.includes(y)) {
        const next = p.filter((x) => x !== y);
        const a = { ...amounts }; delete a[y]; setAmounts(a);
        return next;
      }
      setAmounts((a) => ({ ...a, [y]: 6000 }));
      return [...p, y].sort((a, b) => a - b);
    });

  const grand = useMemo(() => years.reduce((s, y) => s + (amounts[y] || 0), 0), [years, amounts]);

  const submit = () => {
    if (years.length === 0) {
      toast.error("Select at least one tax year.");
      return;
    }
    add({
      clientId,
      type,
      status,
      phase,
      years,
      billing: years.map((y) => ({ year: y, amount: amounts[y] || 0 })),
    });
    toast.success("Engagement added", { description: `${type} · ${years.length} year(s)` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-navy flex items-center gap-2"><Briefcase className="h-4 w-4" /> New Engagement</DialogTitle>
          <DialogDescription>Define scope, phase, years and billing estimates.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1.5 block">Engagement Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as EngagementType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EngagementStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Phase</Label>
              <Select value={phase} onValueChange={(v) => setPhase(v as EngagementPhase)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PHASES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Years</Label>
            <MultiYearSelect
              value={years}
              onToggle={toggle}
              onSelectAll={() => {
                setYears([...ALL_TAX_YEARS]);
                setAmounts(Object.fromEntries(ALL_TAX_YEARS.map((y) => [y, amounts[y] || 6000])));
              }}
              onClear={() => { setYears([]); setAmounts({}); }}
            />
          </div>
          {years.length > 0 && (
            <div className="rounded-lg border border-border bg-gradient-frost p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-cyan">Billing Estimates by Year</p>
              <div className="grid gap-2">
                {years.map((y) => (
                  <div key={y} className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium text-navy">{y}</span>
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        className="pl-7"
                        value={amounts[y] ?? 0}
                        onChange={(e) => setAmounts({ ...amounts, [y]: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="font-semibold text-navy">Grand Total</span>
                <span className="font-bold text-orange tabular-nums">{formatCurrency(grand)}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-navy text-navy-foreground hover:bg-navy/90">Add Engagement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
