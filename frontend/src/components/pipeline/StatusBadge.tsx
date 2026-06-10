// Helper to render a colored status badge per lead status.

import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@/types/crm";
import { cn } from "@/lib/utils";

const META: Record<LeadStatus, { label: string; cls: string }> = {
  new_lead: { label: "New Lead", cls: "bg-cyan/15 text-cyan border-cyan/30" },
  intro_call: { label: "Intro Call", cls: "bg-orange/15 text-orange border-orange/30" },
  feasibility_call: { label: "Feasibility Call", cls: "bg-violet/15 text-violet border-violet/30" },
  tax_preparer_coordination: {
    label: "Tax Preparer Coordination",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  closed: { label: "Closed", cls: "bg-green/15 text-green border-green/30" },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const m = META[status];
  return (
    <Badge variant="outline" className={cn("font-medium", m.cls)}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {m.label}
    </Badge>
  );
}
