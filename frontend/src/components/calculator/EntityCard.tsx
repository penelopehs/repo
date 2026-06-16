// Premium collapsible entity card — entity + financials with eligibility logic.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Trash2,
  Building2,
  DollarSign,
  BadgeCheck,
  AlertCircle,
  Users,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { US_STATES } from "@/constants/states";
import type { Entity } from "@/types/crm";
import { useCalculatorStore } from "@/store/calculatorStore";
import { cn } from "@/lib/utils";
import { STATE_DATA, isEntityComplete } from "@/utils/calculatorEngine";

interface Props {
  entity: Entity;
  index: number;
  taxYear: number;
}

const FINANCIAL_FIELDS: { k: keyof Entity; label: string }[] = [
  { k: "grossRevenue", label: "Gross Revenue" },
  { k: "wagesOfficers", label: "Wages-Officers" },
  { k: "wagesW2", label: "Wages-W2" },
  { k: "contractWages", label: "Contract Wages" },
  { k: "totalSupplies", label: "Total Supplies" },
];

const ENTITY_FILING_OPTIONS = [
  "C-Corp",
  "S-Corp",
  "Partnership",
  "LLC",
  "Sole Proprietorship",
  "Other",
] as const;

export function EntityCard({ entity, index, taxYear }: Props) {
  const [open, setOpen] = useState(true);
  const update = useCalculatorStore((s) => s.updateEntity);
  const remove = useCalculatorStore((s) => s.removeEntity);
  const addOwner = useCalculatorStore((s) => s.addOwner);
  const removeOwner = useCalculatorStore((s) => s.removeOwner);
  const updateOwner = useCalculatorStore((s) => s.updateOwner);

  const stateEligible = !!entity.state && entity.state in STATE_DATA;
  const complete = isEntityComplete(entity);

  const eligibilityReason = !entity.state
    ? "Select a state to evaluate eligibility"
    : !complete
      ? "Fill all required fields to confirm eligibility"
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 border-b border-border bg-gradient-frost px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white text-sm font-bold">
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
          <div className="ml-3 flex items-center gap-2 font-medium text-navy">{taxYear}</div>
        </div>
        <div className="flex items-center gap-2">
          {complete && stateEligible ? (
            <Badge className="bg-green text-green-foreground hover:bg-green">
              <BadgeCheck className="mr-1 h-3 w-3" /> Eligible
            </Badge>
          ) : complete && !stateEligible && entity.state ? (
            <Badge variant="outline" className="border-cyan/40 text-cyan bg-cyan/5">
              <BadgeCheck className="mr-1 h-3 w-3" /> Federal Only
            </Badge>
          ) : entity.state && !complete ? (
            <Badge
              variant="outline"
              className="border-destructive/40 text-destructive bg-destructive/5"
            >
              <AlertCircle className="mr-1 h-3 w-3" /> Incomplete
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              remove(entity.id);
            }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Remove entity"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="grid gap-6 p-5 md:grid-cols-2 [&>*:last-child]:md:col-span-2">
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
                            Arizona, California, Colorado, Georgia, Illinois, Massachusetts, New
                            Jersey, New York, Utah.
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
                              {s in STATE_DATA && (
                                <span
                                  title="State Credit Eligible"
                                  className="inline-block h-1.5 w-1.5 rounded-full bg-green"
                                />
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
                  <div>
                    <Label>Entity Tax Structure</Label>
                    <Select
                      value={entity.filingStatus}
                      onValueChange={(v) => update(entity.id, "filingStatus", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_FILING_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {entity.filingStatus === "Other" && (
                      <Input
                        className="mt-2"
                        value={entity.customFilingStatus ?? ""}
                        onChange={(e) => update(entity.id, "customFilingStatus", e.target.value)}
                        placeholder="Describe filing type..."
                        maxLength={80}
                      />
                    )}
                  </div>
                  <div>
                    <Label>Employee Count</Label>
                    <MoneyInput
                      value={entity.employeeCount === "" ? "" : entity.employeeCount}
                      onChange={(e) =>
                        update(entity.id, "employeeCount", e === "" ? "" : Number(e))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Column 2 — Financial Inputs */}
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy">
                  <DollarSign className="h-4 w-4 text-orange" /> Financial Inputs
                </div>
                <div className="grid gap-4">
                  {FINANCIAL_FIELDS.map(({ k, label }) => (
                    <div key={k}>
                      <Label>{label}</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <MoneyInput
                          value={entity[k] as number | ""}
                          onChange={(v) => update(entity.id, k, v as never)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Eligibility alert */}
                  {complete && stateEligible ? (
                    <div className="rounded-lg border border-green/30 bg-green/5 p-3 text-sm text-green">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <BadgeCheck className="h-4 w-4" /> Eligible for R&amp;D Tax Credit (Federal
                        + State)
                      </span>
                    </div>
                  ) : complete && !stateEligible ? (
                    <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-3 text-sm text-cyan">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <BadgeCheck className="h-4 w-4" /> Federal credit only — no state credit for
                        this state
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <AlertCircle className="h-4 w-4" /> {eligibilityReason}
                      </span>
                    </div>
                  )}

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

              {/* Ownership Breakdown — full width */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <Users className="h-4 w-4 text-violet" /> Ownership Breakdown
                  </div>
                  <button
                    type="button"
                    onClick={() => addOwner(entity.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-navy hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add Owner
                  </button>
                </div>

                {entity.owners.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground text-center">
                    No owners added yet.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {entity.owners.map((owner) => {
                      const pct = typeof owner.ownershipPct === "number" ? owner.ownershipPct : 0;
                      return (
                        <div
                          key={owner.id}
                          className="relative rounded-lg border border-border bg-muted/30 p-3 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => removeOwner(entity.id, owner.id)}
                            className="absolute right-2 top-2 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove owner"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>

                          <div className="grid grid-cols-2 gap-2 pr-4">
                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">First Name</p>
                              <input
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-navy outline-none focus:ring-1 focus:ring-violet/40"
                                value={owner.firstName}
                                onChange={(e) =>
                                  updateOwner(entity.id, owner.id, "firstName", e.target.value)
                                }
                                placeholder="Jane"
                                maxLength={60}
                              />
                            </div>
                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">Last Name</p>
                              <input
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-navy outline-none focus:ring-1 focus:ring-violet/40"
                                value={owner.lastName}
                                onChange={(e) =>
                                  updateOwner(entity.id, owner.id, "lastName", e.target.value)
                                }
                                placeholder="Doe"
                                maxLength={60}
                              />
                            </div>
                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">Role</p>
                              <input
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-navy outline-none focus:ring-1 focus:ring-violet/40"
                                value={owner.role}
                                onChange={(e) =>
                                  updateOwner(entity.id, owner.id, "role", e.target.value)
                                }
                                placeholder="CEO"
                                maxLength={60}
                              />
                            </div>
                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">Ownership %</p>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="w-full rounded border border-border bg-background py-1 pl-2 pr-6 text-xs text-navy outline-none focus:ring-1 focus:ring-violet/40"
                                  value={owner.ownershipPct === "" ? "" : owner.ownershipPct}
                                  onChange={(e) =>
                                    updateOwner(
                                      entity.id,
                                      owner.id,
                                      "ownershipPct",
                                      e.target.value === ""
                                        ? ""
                                        : Math.min(100, Number(e.target.value)),
                                    )
                                  }
                                  placeholder="0"
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                            <span className="font-semibold text-navy">
                              {owner.firstName || owner.lastName
                                ? `${owner.firstName} ${owner.lastName}`.trim()
                                : "Unnamed"}
                            </span>
                            <span
                              className={cn(
                                "font-bold tabular-nums",
                                pct > 0 ? "text-violet" : "text-muted-foreground",
                              )}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {entity.owners.length > 0 &&
                  (() => {
                    const total = entity.owners.reduce(
                      (sum, o) => sum + (typeof o.ownershipPct === "number" ? o.ownershipPct : 0),
                      0,
                    );
                    const over = total > 100;
                    return (
                      <div
                        className={cn(
                          "mt-2 flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold",
                          over ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-navy",
                        )}
                      >
                        <span>Total Ownership</span>
                        <span className="tabular-nums">
                          {total}%{over ? " — exceeds 100%" : total === 100 ? " ✓" : ""}
                        </span>
                      </div>
                    );
                  })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
