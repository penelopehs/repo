// Helper to render a colored status badge per lead status.

import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@/types/crm";
import { cn } from "@/lib/utils";

const META: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-cyan/15 text-cyan border-cyan/30" },
  calculation_sent: { label: "Calculation Sent", cls: "bg-orange/15 text-orange border-orange/30" },
  sow_signed: { label: "SOW Signed", cls: "bg-violet/15 text-violet border-violet/30" },
  active_engagement: { label: "Active Engagement", cls: "bg-green/15 text-green border-green/30" },
  lost: { label: "Lost", cls: "bg-destructive/10 text-destructive border-destructive/30" },
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
