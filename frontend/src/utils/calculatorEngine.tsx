import { toNumber } from "@/utils/format";
import type { Entity } from "@/types/crm";

export interface EntityFormulaResult {
  formula2: number;
  formula3: number;
  formula50: number;
  sowEstimate: number;
}

export interface FederalEstimateResult {
  federal: number;
  conditionUsed: 1 | 2 | 3 | 4;
  Sum_50: number;
  Sum_3: number;
  Sum_2: number;
  Total_Officers_W2: number;
  Total_Contract: number;
  Total_Gross: number;
  Total_All_Wages: number;
}

export interface StateCreditResult {
  creditUtilizationAmount: number;
  stateCreditEstimate: number;
  stateData: { utilizationCap: number; taxRate: number } | null;
}

export const TIER_RANGES: { tier: string; min: number; max: number }[] = [
  { tier: "Micro", min: 6000, max: 25000 },
  { tier: "Starter", min: 25001, max: 50000 },
  { tier: "Core", min: 50001, max: 75000 },
  { tier: "Growth", min: 75001, max: 100000 },
  { tier: "Expansion", min: 100001, max: 150000 },
  { tier: "Elite", min: 150001, max: 250000 },
  { tier: "Strategic", min: 250001, max: 350000 },
  { tier: "Executive", min: 350001, max: 5000000 },
  { tier: "Custom", min: 5000001, max: Infinity },
];

export const TIER_PCT: Record<string, number> = {
  Micro: 0.213,
  Starter: 0.208,
  Core: 0.186,
  Growth: 0.175,
  Expansion: 0.17,
  Elite: 0.146,
  Strategic: 0.133,
  Executive: 0.13,
};

export const STATE_DATA: Record<string, { utilizationCap: number; taxRate: number }> = {
  Utah: { utilizationCap: 0.75, taxRate: 0.0465 },
  Arizona: { utilizationCap: 0.6, taxRate: 0.025 },
  California: { utilizationCap: 0.75, taxRate: 0.133 },
  "New York": { utilizationCap: 0.75, taxRate: 0.109 },
  Colorado: { utilizationCap: 1.0, taxRate: 0.044 },
  Illinois: { utilizationCap: 0.3, taxRate: 0.0495 },
  Massachusetts: { utilizationCap: 0.8, taxRate: 0.09 },
  Georgia: { utilizationCap: 0.85, taxRate: 0.0575 },
  "New Jersey": { utilizationCap: 0.7, taxRate: 0.1075 },
};

function entityInputs(entity: Entity) {
  return {
    grossRevenue: toNumber(entity.grossRevenue),
    wagesW2: toNumber(entity.wagesW2),
    contractWages: toNumber(entity.contractWages),
    totalSupplies: toNumber(entity.totalSupplies),
    wagesOfficers: toNumber(entity.wagesOfficers),
  };
}

export function entityFormulas(entity: Entity): EntityFormulaResult {
  const { grossRevenue, wagesW2, contractWages, totalSupplies, wagesOfficers } =
    entityInputs(entity);

  const formula2 = grossRevenue * 0.02;
  const formula3 = grossRevenue * 0.03;
  const formula50 =
    ((wagesOfficers + wagesW2 + totalSupplies) * 0.5 + contractWages * 0.64) * 0.1;
  const sowEstimate = formula2 + formula3 + formula50;

  return { formula2, formula3, formula50, sowEstimate };
}

/** Step 2 — per-entity SOW estimate (mirrors Calc.entityFormulas → sowEstimate). */
export function calculateSOW(entity: Entity): number {
  return entityFormulas(entity).sowEstimate;
}

/** Step 3 — aggregate federal credit estimate across all entities. */
export function calculateFederal(entities: Entity[]): FederalEstimateResult {
  let Sum_50 = 0;
  let Sum_3 = 0;
  let Sum_2 = 0;
  let Total_Officers_W2 = 0;
  let Total_Contract = 0;
  let Total_Gross = 0;

  entities.forEach((e) => {
    const f = entityFormulas(e);
    Sum_50 += f.formula50;
    Sum_3 += f.formula3;
    Sum_2 += f.formula2;
    Total_Officers_W2 += toNumber(e.wagesOfficers) + toNumber(e.wagesW2);
    Total_Contract += toNumber(e.contractWages);
    Total_Gross += toNumber(e.grossRevenue);
  });

  const Total_All_Wages = Total_Officers_W2 + Total_Contract;

  let federal: number;
  let conditionUsed: 1 | 2 | 3 | 4;

  if (Total_Officers_W2 > 0.1 * Total_Gross) {
    federal = Sum_50 * 0.85 + Sum_3 * 0.1 + Sum_2 * 0.05;
    conditionUsed = 1;
  } else if (Total_Contract > 0.4 * Total_All_Wages) {
    federal = Sum_50 * 0.55 + Sum_3 * 0.3 + Sum_2 * 0.15;
    conditionUsed = 2;
  } else if (Total_Officers_W2 < 0.05 * Total_Gross) {
    federal = Sum_50 * 0.5 + Sum_3 * 0.35 + Sum_2 * 0.15;
    conditionUsed = 3;
  } else {
    federal = Sum_50 * 0.7 + Sum_3 * 0.2 + Sum_2 * 0.1;
    conditionUsed = 4;
  }

  return {
    federal,
    conditionUsed,
    Sum_50,
    Sum_3,
    Sum_2,
    Total_Officers_W2,
    Total_Contract,
    Total_Gross,
    Total_All_Wages,
  };
}

/** Step 4 — state credit for one entity using the engagement federal estimate. */
export function calculateState(state: string, federal: number): StateCreditResult {
  const stateData = STATE_DATA[state];
  if (!stateData || !federal) {
    return { creditUtilizationAmount: 0, stateCreditEstimate: 0, stateData: null };
  }
  const creditUtilizationAmount = federal * stateData.utilizationCap;
  const stateCreditEstimate = creditUtilizationAmount;
  return { creditUtilizationAmount, stateCreditEstimate, stateData };
}

export function getTier(federal: number): string {
  if (!federal || federal < 6000) return "Out of Range";
  const match = TIER_RANGES.find((r) => federal >= r.min && federal <= r.max);
  return match ? match.tier : "Out of Range";
}

export function getFinalBill(federal: number, tier: string) {
  const rate = TIER_PCT[tier];
  if (rate == null) return null;
  const computed = federal * rate;
  // Final bill can never be below $6,000 — floor to a seeded value in [$6,000, $8,000].
  const finalBill = computed < 6000
    ? 6000 + seededRand(federal, 77) * 2000
    : computed;
  return { finalBill, billingRate: rate };
}

function seededRand(seed: number, index: number): number {
  const x = Math.sin(seed * 9301 + index * 49297 + 233) * 803458.4;
  return x - Math.floor(x);
}

export function getPhases(finalBill: number, seed: number = finalBill) {
  // Generate 4 weights in [0.12, 0.42] so no phase is trivially small or dominant.
  const raw = [0, 1, 2, 3].map((i) => 0.12 + seededRand(seed, i) * 0.30);
  const sum = raw.reduce((a, b) => a + b, 0);
  const [w1, w2, w3, w4] = raw.map((r) => r / sum);

  // Apply $6k floor to phase 1; redistribute any excess proportionally across 2-4.
  let phase1 = Math.max(6000, finalBill * w1);
  const remaining = finalBill - phase1;
  const rSum = w2 + w3 + w4;

  return {
    phase1,
    phase2: remaining * (w2 / rSum),
    phase3: remaining * (w3 / rSum),
    phase4: remaining * (w4 / rSum),
    total: finalBill,
  };
}

export interface EngagementCalculation {
  entityFormulas: Array<EntityFormulaResult & { id: string; name: string }>;
  aggregate: FederalEstimateResult;
  federal: number;
  tier: string;
  billing: { finalBill: number; billingRate: number } | null;
  phases: ReturnType<typeof getPhases> | null;
  stateCredits: Array<{
    entityName: string;
    state: string;
    federalShare: number;
    creditUtilizationAmount: number;
    stateCreditEstimate: number;
    stateData: { utilizationCap: number; taxRate: number } | null;
  }>;
}

export function runEngagementCalculation(entities: Entity[]): EngagementCalculation {
  const entityFormulasList = entities.map((e) => ({
    id: e.id,
    name: e.companyName || `Entity`,
    ...entityFormulas(e),
  }));

  const aggregate = calculateFederal(entities);
  const { federal } = aggregate;
  const tier = getTier(federal);
  const billing = tier !== "Out of Range" ? getFinalBill(federal, tier) : null;
  const phases = billing ? getPhases(billing.finalBill, federal) : null;

  const totalSOW = entityFormulasList.reduce((sum, ef) => sum + ef.sowEstimate, 0);

  const stateCredits = entities.map((e, i) => {
    const entitySOW = entityFormulasList[i].sowEstimate;
    const federalShare = totalSOW > 0 ? federal * (entitySOW / totalSOW) : 0;
    return {
      entityName: e.companyName || `Entity`,
      state: e.state || "",
      federalShare,
      ...calculateState(e.state, federalShare),
    };
  });

  return {
    entityFormulas: entityFormulasList,
    aggregate,
    federal,
    tier,
    billing,
    phases,
    stateCredits,
  };
}

export function isEntityComplete(e: Entity): boolean {
  const filingOk =
    !!e.filingStatus &&
    (e.filingStatus !== "Other" || !!e.customFilingStatus?.trim());
  const hasText = !!e.companyName?.trim() && !!e.state && filingOk;
  const numericFields: (keyof Entity)[] = [
    "grossRevenue",
    "wagesOfficers",
    "wagesW2",
    "contractWages",
    "totalSupplies",
  ];
  return (
    hasText &&
    numericFields.every((k) => e[k] !== "" && e[k] !== null && e[k] !== undefined)
  );
}
