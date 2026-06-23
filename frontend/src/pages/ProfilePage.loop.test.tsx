import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/types/crm";

// ── Heavy/irrelevant deps stubbed so the page mounts in happy-dom ───────────────
// (factories are hoisted above module scope, so the stub is defined inline.)
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("framer-motion", () => {
  const P = ({ children }: { children?: ReactNode }) => children ?? null;
  return { motion: new Proxy({}, { get: () => P }), AnimatePresence: P };
});
vi.mock("recharts", () => {
  const P = ({ children }: { children?: ReactNode }) => children ?? null;
  return {
    BarChart: P,
    Bar: P,
    XAxis: P,
    YAxis: P,
    Tooltip: P,
    ResponsiveContainer: P,
    CartesianGrid: P,
  };
});

// ── Service mocks — leadsApi.get is the call the loop hammers ───────────────────
let getCalls = 0;
const baseLead: Lead = {
  id: "1",
  fullName: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  email: "ada@analytical.io",
  phone: "555-0100",
  source: "Referral" as Lead["source"],
  rep: "Dev" as Lead["rep"],
  status: "new_lead" as Lead["status"],
  engagementYears: 0,
  taxYears: [2023],
  engagedSince: "2026-01-01",
  entitiesCount: 0,
  entityNames: [],
  data: { entities: [], people: [], calculations: {} } as Lead["data"],
  latestCalculation: "—",
  addedAt: "2026-01-01",
  engagements: [],
  intakeNotes: [],
};

vi.mock("@/services/leads", () => ({
  leadsApi: {
    // Returns a fresh object each call, mirroring the real API/store behaviour
    // that replaces the lead object on every fetch (this churn is what made the
    // cluster-keyed effects loop before the fix).
    get: vi.fn(async () => {
      getCalls++;
      return { ...baseLead };
    }),
    list: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(async () => ({ ...baseLead })),
    remove: vi.fn(),
  },
}));
vi.mock("@/services/followUpCalls", () => ({
  followUpCallsApi: {
    list: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/services/intakeNotes", () => ({
  intakeNotesApi: {
    list: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("@/services/users", () => ({
  usersApi: {
    me: vi.fn(async () => ({ iduser: 1, first_name: "Dev", last_name: "User", email: "d@e.f" })),
    list: vi.fn(async () => []),
  },
}));

import { ProfilePage } from "./ProfilePage";

beforeEach(() => {
  getCalls = 0;
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("ProfilePage — no infinite fetch loop on entry", () => {
  it("hydrates the lead a bounded number of times", async () => {
    render(<ProfilePage id="1" />);
    // Let effects + any (buggy) re-render cascade settle. Before the fix this
    // cascaded forever (fetchLead → store write → new cluster ref → effect → …).
    await new Promise((r) => setTimeout(r, 600));
    expect(getCalls).toBeLessThan(8);
  });
});
