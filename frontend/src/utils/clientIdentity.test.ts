import { describe, expect, test } from "vitest";
import type { Lead } from "@/types/crm";
import {
  canonicalLeadId,
  getClientCluster,
  leadsMatch,
  mergeLeadsForDisplay,
} from "./clientIdentity";

const base = (over: Partial<Lead> & { id: string }): Lead =>
  ({
    id: over.id,
    fullName: over.fullName ?? "Jane Doe",
    firstName: "Jane",
    lastName: "Doe",
    company: "Acme LLC",
    email: over.email ?? "jane@acme.com",
    phone: over.phone ?? "(555) 111-2222",
    source: "Referral",
    rep: over.rep ?? "Rep A",
    status: "intro_call",
    engagementYears: 1,
    taxYears: over.taxYears ?? [2024],
    engagedSince: "2024-01-01",
    entitiesCount: 1,
    entityNames: over.entityNames ?? ["Acme LLC"],
    latestCalculation: over.latestCalculation ?? "2024-06-01",
    addedAt: over.addedAt ?? "2024-01-15T00:00:00Z",
  }) as Lead;

describe("client identity matching", () => {
  test("matches when name, entity, and email align", () => {
    const a = base({ id: "1" });
    const b = base({ id: "2", taxYears: [2025], rep: "Rep B", addedAt: "2024-03-01T00:00:00Z" });
    expect(leadsMatch(a, b)).toBe(true);
  });

  test("does not match when entity differs", () => {
    const a = base({ id: "1" });
    const b = base({ id: "2", entityNames: ["Other Corp"] });
    expect(leadsMatch(a, b)).toBe(false);
  });

  test("does not match when contact differs", () => {
    const a = base({ id: "1" });
    const b = base({ id: "2", email: "other@acme.com", phone: "(555) 999-0000" });
    expect(leadsMatch(a, b)).toBe(false);
  });

  test("clusters transitively through a middle record", () => {
    const a = base({ id: "1", email: "a@acme.com", phone: "" });
    const b = base({ id: "2", email: "a@acme.com", phone: "(555) 111-2222" });
    const c = base({ id: "3", email: "c@acme.com", phone: "(555) 111-2222" });
    const all = [a, b, c];
    expect(getClientCluster(a, all).map((l) => l.id).sort()).toEqual(["1", "2", "3"]);
  });

  test("canonical id prefers earliest added date", () => {
    const a = base({ id: "10", addedAt: "2024-06-01T00:00:00Z" });
    const b = base({ id: "5", addedAt: "2024-01-01T00:00:00Z" });
    expect(canonicalLeadId(a, [a, b])).toBe("5");
  });

  test("merge combines tax years and latest calculation", () => {
    const a = base({ id: "1", taxYears: [2023], latestCalculation: "2024-01-01" });
    const b = base({ id: "2", taxYears: [2025], latestCalculation: "2024-09-01" });
    const merged = mergeLeadsForDisplay([a, b], "1");
    expect(merged.taxYears).toEqual([2023, 2025]);
    expect(merged.latestCalculation).toBe("2024-09-01");
  });
});
