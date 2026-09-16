import { monthKey, pctChange } from "./format";

function yearOverYearKey(key) {
  const [y, m] = key.split("-");
  return `${Number(y) - 1}-${m}`;
}

// Totals across ALL recurring bills for each month they were paid — a rough
// personal spend/inflation index independent of any single bill.
export function monthlyBillTotals(data) {
  const totals = {};
  Object.keys(data.billPayments).forEach((key) => {
    if (key.startsWith("once-")) return;
    Object.values(data.billPayments[key]).forEach((entry) => {
      if (entry?.paid && entry.amount != null) totals[key] = (totals[key] || 0) + Number(entry.amount);
    });
  });
  return Object.entries(totals).map(([key, amount]) => ({ key, amount })).sort((a, b) => a.key.localeCompare(b.key));
}

// Money actually spent (charges only — bills, layaway, manual purchases) on
// a given card, grouped by month, for the Analytics "by card" drill-down.
export function cardMonthlySpend(card, data) {
  const totals = {};
  data.cardTransactions.filter((t) => t.cardId === card.id && t.type === "charge").forEach((t) => {
    const key = monthKey(new Date(t.date));
    totals[key] = (totals[key] || 0) + Number(t.amount);
  });
  return Object.entries(totals).map(([key, amount]) => ({ key, amount })).sort((a, b) => a.key.localeCompare(b.key));
}

// Summary figures for any {key, amount} series, used across the global and
// drilled-down Analytics views.
export function seriesStats(series) {
  if (!series || series.length === 0) return null;
  const amounts = series.map((e) => e.amount);
  const total = amounts.reduce((a, b) => a + b, 0);
  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  const mom = prev ? pctChange(latest.amount, prev.amount) : null;
  const yoyEntry = series.find((e) => e.key === yearOverYearKey(latest.key));
  const yoy = yoyEntry ? pctChange(latest.amount, yoyEntry.amount) : null;
  return { total, avg: total / amounts.length, min: Math.min(...amounts), max: Math.max(...amounts), latest, mom, yoy, count: series.length };
}

export { yearOverYearKey };
