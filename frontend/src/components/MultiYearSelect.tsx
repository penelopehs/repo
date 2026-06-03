// Multi-select for tax years with "All Years" toggle.

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { TaxYear } from "@/types/crm";
import { ALL_TAX_YEARS } from "@/types/crm";
import { cn } from "@/lib/utils";

interface Props {
  value: TaxYear[];
  onToggle: (y: TaxYear) => void;
  onSelectAll: () => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export function MultiYearSelect({
  value,
  onToggle,
  onSelectAll,
  onClear,
  placeholder = "Select years",
  className,
}: Props) {
  const allSelected = value.length === ALL_TAX_YEARS.length;
  const label =
    value.length === 0
      ? placeholder
      : allSelected
        ? "All Years (2020–2026)"
        : value.length <= 3
          ? value.join(", ")
          : `${value.length} years selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {label}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <button
          type="button"
          onClick={allSelected ? onClear : onSelectAll}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <span>{allSelected ? "Clear all" : "All Years"}</span>
          {allSelected && <Check className="h-4 w-4 text-cyan" />}
        </button>
        <Separator className="my-1.5" />
        <div className="grid grid-cols-2 gap-1">
          {ALL_TAX_YEARS.map((y) => {
            const active = value.includes(y);
            return (
              <button
                key={y}
                type="button"
                onClick={() => onToggle(y)}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                  active ? "bg-cyan/10 text-navy font-medium" : "hover:bg-accent",
                )}
              >
                <span>{y}</span>
                {active && <Check className="h-3.5 w-3.5 text-cyan" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function YearChips({ years, className }: { years: TaxYear[]; className?: string }) {
  if (years.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const isAll = years.length === ALL_TAX_YEARS.length;
  if (isAll) return <Badge className="bg-navy text-white hover:bg-navy">All Years</Badge>;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {years.map((y) => (
        <Badge key={y} variant="outline" className="border-cyan/40 text-navy bg-cyan/5">
          {y}
        </Badge>
      ))}
    </div>
  );
}
