export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const money = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d; };
export const iso = (d) => d.toISOString().slice(0, 10);

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

export const pctChange = (curr, prev) => (prev ? ((curr - prev) / prev) * 100 : null);
export const fmtPct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
export const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export const toneWord = (v) => (v == null ? "ink" : v > 0 ? "rust" : v < 0 ? "bottle" : "ink");
export const toneColor = (v) => (v == null ? "var(--ink-soft)" : v > 0 ? "var(--rust)" : v < 0 ? "var(--bottle)" : "var(--ink-soft)");
