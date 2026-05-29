// ─── Reference Data Tables ──────────────────────────────────────────────────
// Source: calcu.csv + calculator.docx (Master Sales Billing Workbook)

const SalesData = {

  TIER_RANGES: [
    { tier: 'Micro',     min: 6000,   max: 25000   },
    { tier: 'Starter',   min: 25001,  max: 50000   },
    { tier: 'Core',      min: 50001,  max: 75000   },
    { tier: 'Growth',    min: 75001,  max: 100000  },
    { tier: 'Expansion', min: 100001, max: 150000  },
    { tier: 'Elite',     min: 150001, max: 250000  },
    { tier: 'Strategic', min: 250001, max: 350000  },
    { tier: 'Executive', min: 350001, max: 500000  },
    { tier: 'Custom',    min: 500001, max: 5000000 },
  ],

  // tbl_TierPercentage_Federal / State (same values per source)
  TIER_PCT: {
    Micro: 0.213, Starter: 0.208, Core: 0.186, Growth: 0.175,
    Expansion: 0.170, Elite: 0.146, Strategic: 0.133, Executive: 0.130, Custom: 0.103,
  },

  // Hourly rate = "Total" column from Hourly Change table (base + 35% + 21%)
  HOURLY_RATES: {
    Micro: 738, Starter: 738, Core: 847, Growth: 908,
    Expansion: 968, Elite: 1029, Strategic: 1089, Executive: 1150, Custom: 1210,
  },

  // Phase I–IV percentage splits per tier
  PHASE_PCT: {
    Micro:     { I: 0.40, II: 0.25, III: 0.15, IV: 0.20 },
    Starter:   { I: 0.40, II: 0.25, III: 0.15, IV: 0.20 },
    Core:      { I: 0.40, II: 0.25, III: 0.15, IV: 0.20 },
    Growth:    { I: 0.40, II: 0.25, III: 0.15, IV: 0.20 },
    Expansion: { I: 0.40, II: 0.25, III: 0.15, IV: 0.20 },
    Elite:     { I: 0.35, II: 0.25, III: 0.20, IV: 0.20 },
    Strategic: { I: 0.35, II: 0.25, III: 0.20, IV: 0.20 },
    Executive: { I: 0.35, II: 0.25, III: 0.20, IV: 0.20 },
    Custom:    { I: 0.35, II: 0.25, III: 0.20, IV: 0.20 },
  },

  // Distribution splits (Entities 45%, Staff 30%, QRA 25%) — same all tiers
  DISTRIBUTION: { entities: 0.45, staff: 0.30, qra: 0.25 },

  // State credit data — only states present in the workbook's state table
  STATE_DATA: {
    'Utah':          { utilizationCap: 0.75, taxRate: 0.0465, type: 'Flat'   },
    'Arizona':       { utilizationCap: 0.60, taxRate: 0.0250, type: 'Flat'   },
    'California':    { utilizationCap: 0.75, taxRate: 0.1330, type: 'Tiered' },
    'New York':      { utilizationCap: 0.75, taxRate: 0.1090, type: 'Tiered' },
    'Colorado':      { utilizationCap: 1.00, taxRate: 0.0440, type: 'Flat'   },
    'Illinois':      { utilizationCap: 0.30, taxRate: 0.0495, type: 'Flat'   },
    'Massachusetts': { utilizationCap: 0.80, taxRate: 0.0900, type: 'Tiered' },
    'Georgia':       { utilizationCap: 0.85, taxRate: 0.0575, type: 'Flat'   },
    'New Jersey':    { utilizationCap: 0.70, taxRate: 0.1075, type: 'Tiered' },
  },

  // Full 50-state credit eligibility lookup
  STATE_CREDIT_ELIGIBLE: {
    Alabama: false, Alaska: false, Arizona: true, Arkansas: false,
    California: true, Colorado: false, Connecticut: false, Delaware: false,
    Florida: false, Georgia: true, Hawaii: false, Idaho: false,
    Illinois: true, Indiana: false, Iowa: true, Kansas: false,
    Kentucky: false, Louisiana: false, Maine: false, Maryland: false,
    Massachusetts: false, Michigan: false, Minnesota: false, Mississippi: false,
    Missouri: false, Montana: false, Nebraska: false, Nevada: false,
    'New Hampshire': false, 'New Jersey': true, 'New Mexico': false,
    'New York': true, 'North Carolina': true, 'North Dakota': false,
    Ohio: false, Oklahoma: false, Oregon: false, Pennsylvania: false,
    'Rhode Island': false, 'South Carolina': false, 'South Dakota': false,
    Tennessee: false, Texas: false, Utah: true, Vermont: false,
    Virginia: false, Washington: false, 'West Virginia': false,
    Wisconsin: false, Wyoming: false,
  },

  // Custom tier sliding-scale percentages (by max SOW bracket)
  CUSTOM_TIER_PCT: [
    { maxSOW: 500000,  pct: 0.130 },
    { maxSOW: 750000,  pct: 0.125 },
    { maxSOW: 1000000, pct: 0.120 },
    { maxSOW: 1500000, pct: 0.115 },
    { maxSOW: 2000000, pct: 0.105 },
    { maxSOW: 2500000, pct: 0.098 },
    { maxSOW: 3000000, pct: 0.085 },
    { maxSOW: 3500000, pct: 0.080 },
    { maxSOW: 4000000, pct: 0.075 },
  ],

  // Micro credit lookup table (credit amount → flat credit value)
  MICRO_CREDIT_TABLE: [
    { amount: 6000,  creditVal: 6000  },
    { amount: 8500,  creditVal: 8500  },
    { amount: 11000, creditVal: 11000 },
    { amount: 14000, creditVal: 14000 },
    { amount: 17500, creditVal: 17500 },
    { amount: 20000, creditVal: 20000 },
    { amount: 25000, creditVal: 25000 },
  ],

  // Federal tax rates by filing status
  TAX_RATES: {
    'Single': 0.21,
    'Married Filing Jointly': 0.35,
    '280(c)': 0.21,
  },

  ALL_STATES: [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
    'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
    'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
    'Maine','Maryland','Massachusetts','Michigan','Minnesota',
    'Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
    'Rhode Island','South Carolina','South Dakota','Tennessee','Texas',
    'Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming',
  ],

  TIER_COLORS: {
    'Micro':     { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    'Starter':   { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    'Core':      { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    'Growth':    { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    'Expansion': { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
    'Elite':     { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
    'Strategic': { bg: '#fdf4ff', border: '#d8b4fe', text: '#6b21a8' },
    'Executive': { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
    'Custom':    { bg: '#1e3a5f', border: '#1e3a5f', text: '#ffffff' },
    'Out of Range': { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  },
};