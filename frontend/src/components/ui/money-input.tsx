import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  className?: string;
}

function formatFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

// Insert commas into a raw digit string, preserving a partial decimal tail.
function applyMask(raw: string): string {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const formatted = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${formatted}.${dec}` : formatted;
}

// Strip commas (and anything non-numeric except one decimal point).
function stripToRaw(s: string): string {
  let v = s.replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  return v;
}

// Given a raw prefix (digits+dot only), find where it ends in the masked string.
function cursorInMasked(masked: string, rawPrefix: string): number {
  if (rawPrefix.length === 0) return 0;
  let rawCount = 0;
  for (let i = 0; i < masked.length; i++) {
    if (/[\d.]/.test(masked[i])) rawCount++;
    if (rawCount === rawPrefix.length) return i + 1;
  }
  return masked.length;
}

export function MoneyInput({ value, onChange, placeholder = "0", className }: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextCursor = useRef<number | null>(null);
  const focused = useRef(false);

  const [display, setDisplay] = useState(() =>
    value === "" ? "" : formatFull(value as number),
  );

  // Sync when the value is updated externally (e.g. lead hydration) while not editing.
  useEffect(() => {
    if (!focused.current) {
      setDisplay(value === "" ? "" : formatFull(value as number));
    }
  }, [value]);

  // Restore cursor after React re-renders the input with the new masked value.
  useLayoutEffect(() => {
    if (nextCursor.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(nextCursor.current, nextCursor.current);
      nextCursor.current = null;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cursor = e.target.selectionStart ?? 0;
    const newVal = e.target.value;

    const rawBeforeCursor = stripToRaw(newVal.slice(0, cursor));
    const raw = stripToRaw(newVal);
    const masked = applyMask(raw);

    nextCursor.current = cursorInMasked(masked, rawBeforeCursor);
    setDisplay(masked);

    const parsed = parseFloat(raw);
    onChange(raw === "" || isNaN(parsed) ? "" : parsed);
  };

  const handleFocus = () => {
    focused.current = true;
  };

  const handleBlur = () => {
    focused.current = false;
    // Normalise to two decimal places on exit.
    setDisplay(value === "" ? "" : formatFull(value as number));
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className={cn("pl-7", className)}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
    />
  );
}
