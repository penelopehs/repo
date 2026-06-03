import { describe, expect, test } from "vitest";
import { formatCurrency, formatDate, formatNumber, toNumber } from "./format";

describe("format utilities", () => {
  test("formatCurrency formats a number as USD without decimals", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
    expect(formatCurrency(-50)).toBe("-$50");
  });

  test("formatNumber formats a number with locale separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(0)).toBe("0");
  });

  test("formatDate formats an ISO date in en-US UTC", () => {
    expect(formatDate("2024-06-01")).toBe("Jun 1, 2024");
  });

  test("toNumber converts strings and numeric values to finite numbers", () => {
    expect(toNumber("1,234")).toBe(1234);
    expect(toNumber("1,234.56")).toBe(1234.56);
    expect(toNumber("abc")).toBe(0);
    expect(toNumber("")).toBe(0);
    expect(toNumber(42)).toBe(42);
  });
});
