// Shared formatting helpers.

export const formatCurrency = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat("en-US").format(Number.isFinite(n) ? n : 0);

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export const toNumber = (v: number | string | ""): number => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
