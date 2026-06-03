import { describe, expect, test } from "vitest";
import type { Lead } from "@/types/crm";
import { buildCalculationSearch, hasExistingCalculation } from "./calculationContext";

const lead = {
  id: "ld_001",
  fullName: "Michael Reeves",
  company: "Nimbus Robotics, Inc.",
  email: "m.reeves@nimbusrobotics.com",
  phone: "(415) 555-2310",
  source: "Referral",
  rep: "David Kim",
  status: "calculation_sent",
  engagementYears: 3,
  taxYears: [2023, 2024],
  engagedSince: "2022-03-14",
  entitiesCount: 4,
  entityNames: ["Nimbus Robotics, Inc."],
  latestCalculation: "2025-11-02",
  addedAt: "2022-02-01",
} as Lead;

describe("calculation context helpers", () => {
  test("detects existing calculations from the latest calculation date", () => {
    expect(hasExistingCalculation(lead)).toBe(true);
    expect(hasExistingCalculation({ ...lead, latestCalculation: "—" })).toBe(false);
  });

  test("builds the calculator query with client and tax year context", () => {
    expect(buildCalculationSearch(lead)).toEqual({
      clientName: "Nimbus Robotics, Inc.",
      taxYears: "2023,2024",
      latestCalculation: "2025-11-02",
      hasExistingCalculation: true,
    });
  });
});
