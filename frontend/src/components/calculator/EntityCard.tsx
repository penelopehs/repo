// Premium collapsible entity card — entity + financials with eligibility logic.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trash2, Building2, DollarSign, BadgeCheck, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { US_STATES, isStateCreditEligible } from "@/constants/states";
import type { Entity } from "@/types/crm";
import { useCalculatorStore } from "@/store/calculatorStore";
import { toNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

interface Props {
  entity: Entity;
  index: number;
}

const FINANCIAL_FIELDS: { k: keyof Entity; label: string; suffix?: string }[] = [
  { k: "grossCredit", label: "Gross Credit Amount", suffix: "(Eligible with more than $6,000 USD)" },
  { k: "w2Wages", label: "W2 Wages (Qualified Research)" },
  { k: "contractResearch", label: "Contract Research Payments" },
  { k: "supplies", label: "Supplies" },
  { k: "otherQualified", label: "Other Qualified Expenses" },
];

const GROSS_THRESHOLD = 6000;

export function EntityCard({ entity, index }: Props) {
  const [open, setOpen] = useState(true);
  const update = useCalculatorStore((s) => s.updateEntity);
  const remove = useCalculatorStore((s) => s.removeEntity);

  const stateEligible = !!entity.state && isStateCreditEligible(entity.state);
  const grossNumber = toNumber(entity.grossCredit);
  const grossOk = grossNumber > GROSS_THRESHOLD;
  const fullyEligible = stateEligible && grossOk;

  const eligibilityReason = !entity.state
    ? "Select a state to evaluate eligibility"
    : !stateEligible && !grossOk
      ? "State not eligible · Gross Credit below $6,000"
      : !stateEligible
        ? "State not eligible"
        : !grossOk
          ? "Gross Credit Amount below $6,000"
          : "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-card hover:shadow-elevated transition-shadow"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 border-b border-border bg-gradient-frost px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-navy-foreground text-sm font-bold">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy truncate">
              {entity.companyName || `Entity ${index + 1}`}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {entity.state || "State not selected"}
              {stateEligible && " · State Credit Eligible"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fullyEligible ? (
            <Badge className="bg-green text-green-foreground hover:bg-green">
              <BadgeCheck className="mr-1 h-3 w-3" /> Eligible
            </Badge>
          ) : entity.state ? (
            <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/5">
              <AlertCircle className="mr-1 h-3 w-3" /> Not eligible
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); remove(entity.id); }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Remove entity"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="grid gap-6 p-5 md:grid-cols-2">
              {/* Column 1 — Entity Information */}
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy">
                  <Building2 className="h-4 w-4 text-cyan" /> Entity Information
                </div>
                <div className="grid gap-4">
                  <div>
                    <Label>Company / Entity Name</Label>
                    <Input
                      value={entity.companyName}
                      onChange={(e) => update(entity.id, "companyName", e.target.value)}
                      placeholder="Acme Industries, Inc."
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      State of Entity
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-green cursor-help">
                              State Credit Eligible
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Arizona, California, Georgia, Illinois, Iowa, New Jersey, New York, North Carolina, Utah.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Select
                      value={entity.state}
                      onValueChange={(v) => update(entity.id, "state", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-2">
                              {s}
                              {isStateCreditEligible(s) && (
                                <span title="State Credit Eligible" className="inline-block h-1.5 w-1.5 rounded-full bg-green" />
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {stateEligible && (
                      <Badge className="mt-2 bg-green text-green-foreground hover:bg-green">
                        <BadgeCheck className="mr-1 h-3 w-3" /> State Credit Eligible
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Employee Count</Label>
                      <Input
                        type="number"
                        min={0}
                        value={entity.employeeCount === "" ? "" : entity.employeeCount}
                        onChange={(e) => update(entity.id, "employeeCount", e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Estimated QRAs</Label>
                      <Input
                        type="number"
                        min={0}
                        value={entity.estimatedQRAs === "" ? "" : entity.estimatedQRAs}
                        onChange={(e) => update(entity.id, "estimatedQRAs", e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2 — Financial Inputs */}
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy">
                  <DollarSign className="h-4 w-4 text-orange" /> Financial Inputs
                </div>
                <div className="grid gap-4">
                  {FINANCIAL_FIELDS.map(({ k, label, suffix }) => (
                    <div key={k}>
                      <Label className="flex items-baseline gap-2">
                        <span>{label}</span>
                        {suffix && <span className="text-[11px] font-normal text-muted-foreground">{suffix}</span>}
                      </Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          className="pl-7"
                          value={entity[k] as number | ""}
                          onChange={(e) => update(entity.id, k, (e.target.value === "" ? "" : Number(e.target.value)) as never)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Eligibility alert */}
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      fullyEligible
                        ? "border-green/30 bg-green/5 text-green"
                        : "border-destructive/30 bg-destructive/5 text-destructive",
                    )}
                  >
                    {fullyEligible ? (
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <BadgeCheck className="h-4 w-4" /> Eligible for R&amp;D Tax Credit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 font-medium">
                        <AlertCircle className="h-4 w-4" /> {eligibilityReason}
                      </span>
                    )}
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={entity.notes}
                      onChange={(e) => update(entity.id, "notes", e.target.value)}
                      placeholder="Internal notes for this entity..."
                      rows={2}
                      maxLength={1000}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
