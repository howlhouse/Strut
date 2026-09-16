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

// Drops any entry keyed to a month after the real current one. A bill can be
// marked paid against a future billing cycle (prepaying next month's rent,
// say), which correctly records that cycle's payment — but a single paid
// bill isn't a meaningful "month total" to plot next to fully-elapsed
// months, so historical trend views should never show it.
export function excludeFutureMonths(series, now = new Date()) {
  const currentKey = monthKey(now);
  return series.filter((e) => e.key <= currentKey);
}

// Restricts a series to the trailing `rangeMonths` calendar months ending at
// `now` (or returns it unchanged for the "all" range). Used only for what's
// charted/tabled — stats like month-over-month and year-over-year are
// computed from the full (but still future-excluded) series so narrowing
// the visible window never breaks a comparison that needs older data.
export function windowMonths(series, rangeMonths, now = new Date()) {
  if (rangeMonths === "all") return series;
  const start = monthKey(new Date(now.getFullYear(), now.getMonth() - (rangeMonths - 1), 1));
  return series.filter((e) => e.key >= start);
}

// Shared date bounds for the raw-transaction scans below, so every section
// on the Analytics page agrees on what a given range selection means.
function monthRangeBounds(rangeMonths, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  if (rangeMonths === "all") return { start: null, end };
  const start = new Date(now.getFullYear(), now.getMonth() - (rangeMonths - 1), 1);
  return { start, end };
}

// Income vs. spending, by month, from actual logged transactions (not the
// Forecast page's projected incomes). "Income" only counts deposits against
// a bank account or a debit card — paying down a credit card is debt
// reduction, not income, so credit-card payments are deliberately excluded.
// "Spending" counts every charge (bills, layaway, manual) regardless of
// funding source, since it's a record of what was spent, not when cash
// actually left an account.
export function monthlyIncomeVsSpending(data, rangeMonths, now = new Date()) {
  const { start, end } = monthRangeBounds(rangeMonths, now);
  const debitSourceIds = new Set([
    ...data.cards.filter((c) => (c.type || "credit") === "debit").map((c) => c.id),
    ...(data.bankAccounts || []).map((a) => a.id),
  ]);
  const buckets = {};
  const bucket = (key) => (buckets[key] = buckets[key] || { key, income: 0, spending: 0 });

  const scan = (t, sourceId) => {
    const d = new Date(t.date);
    if ((start && d < start) || d > end) return;
    const b = bucket(monthKey(d));
    if (t.type === "charge") b.spending += Number(t.amount);
    else if (debitSourceIds.has(sourceId)) b.income += Number(t.amount);
  };
  data.cardTransactions.forEach((t) => scan(t, t.cardId));
  (data.accountTransactions || []).forEach((t) => scan(t, t.accountId));

  return Object.values(buckets)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ ...b, net: b.income - b.spending }));
}

// Total spend by catalog category over a range, for the "Spending by
// category" breakdown — every charge across cards and accounts, bucketed by
// the categoryId stamped on it (bills inherit their own categoryId when
// marked paid; layaway payments and uncategorized manual charges land in a
// synthetic "Uncategorized" bucket).
export function categorySpendBreakdown(data, catalog, rangeMonths, now = new Date()) {
  const { start, end } = monthRangeBounds(rangeMonths, now);
  const totals = {};
  const scan = (t) => {
    if (t.type !== "charge") return;
    const d = new Date(t.date);
    if ((start && d < start) || d > end) return;
    const key = t.categoryId || "none";
    totals[key] = (totals[key] || 0) + Number(t.amount);
  };
  data.cardTransactions.forEach(scan);
  (data.accountTransactions || []).forEach(scan);

  const categories = catalog?.categories || [];
  const rows = Object.entries(totals)
    .map(([id, amount]) => {
      const cat = categories.find((c) => c.id === id);
      return { id, name: cat?.name || "Uncategorized", color: cat?.color || "var(--ink-soft)", amount };
    })
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return { rows, total };
}

export { yearOverYearKey };
