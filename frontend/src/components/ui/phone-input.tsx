import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

// Strip to at most 10 US digits, dropping a leading country code 1 when present.
function normalizeDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return d.slice(1);
  return d.slice(0, 10);
}

// Apply (XXX) XXX-XXXX mask to a 0-10 digit string.
function applyMask(digits: string): string {
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// After inserting mask characters, find where the cursor should sit so that
// the same number of digits appear before it as before the change.
function cursorInMasked(masked: string, digitsBeforeCursor: number): number {
  if (digitsBeforeCursor === 0) return 0;
  let count = 0;
  for (let i = 0; i < masked.length; i++) {
    if (/\d/.test(masked[i])) count++;
    if (count === digitsBeforeCursor) return i + 1;
  }
  return masked.length;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "(555) 123-4567",
  className,
  autoComplete,
  onFocus,
  onBlur,
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextCursor = useRef<number | null>(null);
  const focused = useRef(false);

  const [display, setDisplay] = useState(() => applyMask(normalizeDigits(value)));

  // Sync when value is set externally (e.g. suggestion picked from CRM).
  useEffect(() => {
    if (!focused.current) {
      setDisplay(applyMask(normalizeDigits(value)));
    }
  }, [value]);

  useLayoutEffect(() => {
    if (nextCursor.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(nextCursor.current, nextCursor.current);
      nextCursor.current = null;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cursor = e.target.selectionStart ?? 0;
    const newVal = e.target.value;

    const digitsBeforeCursor = newVal.slice(0, cursor).replace(/\D/g, "").length;
    const digits = normalizeDigits(newVal);
    const masked = applyMask(digits);

    nextCursor.current = cursorInMasked(masked, digitsBeforeCursor);
    setDisplay(masked);
    onChange(masked);
  };

  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (e) => {
    focused.current = true;
    onFocus?.(e);
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
    focused.current = false;
    onBlur?.(e);
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="tel"
      className={cn(className)}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      autoComplete={autoComplete}
    />
  );
}
