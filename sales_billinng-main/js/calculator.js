// ─── Calculation Engine ──────────────────────────────────────────────────────
// Replicates Excel formulas from calculator.docx / calcu.csv exactly.

const Calc = {

  // ── Tier determination from SOW ─────────────────────────────────────────
  getTier(sow) {
    if (!sow || sow < 6000) return 'Out of Range';
    const match = SalesData.TIER_RANGES.find(r => sow >= r.min && sow <= r.max);
    return match ? match.tier : 'Out of Range';
  },

  // ── Custom tier sliding-scale percentage ────────────────────────────────
  getCustomPct(sow) {
    const entry = SalesData.CUSTOM_TIER_PCT.find(c => sow <= c.maxSOW);
    return entry ? entry.pct : 0.075;
  },

  // ── Target Utilization % ────────────────────────────────────────────────
  // =IF(SOW<=25000, Micro%, XLOOKUP(Tier, tbl_TierPercentage, %))
  getTargetPct(tier, sow) {
    if (tier === 'Out of Range') return 0;
    if (tier === 'Custom') return this.getCustomPct(sow);
    if (sow <= 25000) return SalesData.TIER_PCT['Micro'];
    return SalesData.TIER_PCT[tier] || 0;
  },

  // ── Micro credit lookup ─────────────────────────────────────────────────
  getMicroCredit(grossCredit) {
    const table = SalesData.MICRO_CREDIT_TABLE;
    for (let i = table.length - 1; i >= 0; i--) {
      if (grossCredit >= table[i].amount) return table[i].creditVal;
    }
    return table[0].creditVal;
  },

  // ── SOW calculation — three methods averaged ────────────────────────────
  // 2% test:   Gross Credit × 0.02
  // 3% test:   Gross Credit × 0.03
  // 50% test:  ((W2 + Contract + Other) × 0.5 + Supplies × 0.64) × 0.1
  // SOW Estimate = (2% + 3% + 50%) / 3
  calculateSOW(entity) {
    const { grossCredit = 0, w2Wages = 0, contractResearch = 0,
            supplies = 0, otherExpenses = 0 } = entity;

    const sow2   = grossCredit * 0.02;
    const sow3   = grossCredit * 0.03;
    const sow50  = ((w2Wages + contractResearch + otherExpenses) * 0.5
                    + supplies * 0.64) * 0.1;

    const sowEstimate = (sow2 + sow3 + sow50) / 3;

    // Weighted SOW: 70% weight on 50% test, 20% on 3%, 10% on 2%
    let weighted = 0.7 * sow50 + 0.2 * sow3 + 0.1 * sow2;

    // Adaptive weighting (as per Adaptive SOW Weighted formulas)
    if ((w2Wages + contractResearch) > 0.1 * grossCredit) {
      weighted = sow50 * 0.85 + sow3 * 0.1 + sow2 * 0.05;
    }
    if (supplies > 0.4 * (w2Wages + contractResearch + supplies)) {
      weighted = sow50 * 0.55 + sow3 * 0.3 + sow2 * 0.15;
    }

    return { sow2, sow3, sow50, sowEstimate, weightedSOW: weighted };
  },

  // ── Full entity calculation ──────────────────────────────────────────────
  calculateEntity(entity) {
    const { grossCredit = 0, state = '', taxFilingStatus = 'Single' } = entity;
    const sowData = this.calculateSOW(entity);
    const sow = sowData.sowEstimate;

    const tier = this.getTier(sow);
    if (tier === 'Out of Range') {
      return { ...sowData, tier, error: sow < 6000
        ? 'SOW below minimum ($6,000). Please review inputs.'
        : 'SOW exceeds maximum range. Please review inputs.' };
    }

    const targetPct    = this.getTargetPct(tier, sow);
    const taxRate      = SalesData.TAX_RATES[taxFilingStatus] || 0.21;
    const stateData    = SalesData.STATE_DATA[state];
    const creditElig   = SalesData.STATE_CREDIT_ELIGIBLE[state] || false;
    const hasStateCalc = creditElig && !!stateData;
    const utilizCap    = stateData ? stateData.utilizationCap : 0;

    // ── Hourly calculations ──────────────────────────────────────────────
    // Effective Hourly Rate = TotalHourlyRate × (1 − UtilizationCap) + 0.25
    const hourlyRate    = SalesData.HOURLY_RATES[tier] || 0;
    const effectiveRate = hourlyRate * (1 - utilizCap) + 0.25;
    const billableHours = effectiveRate > 0 ? sow / effectiveRate : 0;

    // Hours distribution (45 / 30 / 25)
    const entityHours   = billableHours * SalesData.DISTRIBUTION.entities;
    const staffHours    = billableHours * SalesData.DISTRIBUTION.staff;
    const qraHours      = billableHours * SalesData.DISTRIBUTION.qra;

    // Fees
    const entityFee = entityHours * effectiveRate;
    const staffFee  = staffHours  * effectiveRate;
    const qraFee    = qraHours    * effectiveRate;
    const totalFee  = entityFee + staffFee + qraFee; // ≈ sow

    // ── Federal Final Bill ───────────────────────────────────────────────
    // Final Bill = Gross Credit × Target Utilization %
    // Federal Adjustment = Final Bill × (1 − Tax Rate)
    const federalBill        = grossCredit * targetPct;
    const federalAdjustment  = federalBill * (1 - taxRate);
    const federalPctOfCredit = grossCredit > 0 ? sow / grossCredit : 0;

    // ── State Final Bill ─────────────────────────────────────────────────
    let creditUtilization = 0, stateBill = 0, stateAdjustment = 0;
    if (hasStateCalc) {
      creditUtilization = grossCredit * utilizCap;
      stateBill = tier === 'Micro'
        ? creditUtilization * targetPct * 0.4
        : creditUtilization * targetPct;
      stateAdjustment = stateBill * (1 - utilizCap);
    }

    // ── Micro Credit lookup ──────────────────────────────────────────────
    const microCredit = tier === 'Micro' ? this.getMicroCredit(grossCredit) : null;

    // ── Phase breakdown ──────────────────────────────────────────────────
    // Phase I  = IF(SOW≤6000, 6000, 6000 + (SOW−6000) × PhaseI%)
    // Phase II–IV = IF(SOW≤6000, 0, (SOW−6000) × Phase%)
    const phases = SalesData.PHASE_PCT[tier];
    const base   = 6000;
    const rem    = Math.max(0, sow - base);
    const phaseI   = sow <= base ? base : base + rem * phases.I;
    const phaseII  = sow <= base ? 0 : rem * phases.II;
    const phaseIII = sow <= base ? 0 : rem * phases.III;
    const phaseIV  = sow <= base ? 0 : rem * phases.IV;
    const totalBill = phaseI + phaseII + phaseIII + phaseIV;

    // ── Manager Review ───────────────────────────────────────────────────
    // Variance % = |Gross Credit − SOW| / SOW
    const variancePct  = sow > 0 ? Math.abs(grossCredit - sow) / sow : 0;
    const needsReview  = variancePct > 0.10;

    return {
      ...sowData,
      tier, targetPct, taxRate,
      stateData, creditElig, hasStateCalc, utilizCap,
      hourlyRate, effectiveRate, billableHours,
      entityHours, staffHours, qraHours,
      entityFee, staffFee, qraFee, totalFee,
      federalBill, federalAdjustment, federalPctOfCredit,
      creditUtilization, stateBill, stateAdjustment,
      microCredit,
      phaseI, phaseII, phaseIII, phaseIV, totalBill,
      variancePct, needsReview,
      grandTotal: federalBill + stateBill,
    };
  },

  // ── Summary across all entities ─────────────────────────────────────────
  summarize(results) {
    return results.reduce((acc, r) => {
      if (r.error) return acc;
      acc.totalFederal  += r.federalBill    || 0;
      acc.totalState    += r.stateBill      || 0;
      acc.totalSOW      += r.sowEstimate    || 0;
      acc.totalBill     += r.grandTotal     || 0;
      acc.totalHours    += r.billableHours  || 0;
      return acc;
    }, { totalFederal: 0, totalState: 0, totalSOW: 0, totalBill: 0, totalHours: 0 });
  },
};