import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, Trash2, X, Check, LayoutDashboard, Receipt, Ticket, Wallet, Pencil, ExternalLink, Sparkles, Eraser, BarChart3, Landmark, TrendingUp,
} from "lucide-react";
import { storage } from "./storage.js";

/* ---------------------------------- helpers ---------------------------------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const money = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d; };
const iso = (d) => d.toISOString().slice(0, 10);

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

// Always resolves to the CURRENT cycle's due date/key for a recurring bill,
// even if that date has already passed and it's still unpaid (so overdue
// bills stay visible instead of silently rolling to next month).
function billDueInfo(bill, from = new Date()) {
  if (bill.frequency === "onetime") {
    const due = new Date(bill.dueDate);
    due.setHours(0, 0, 0, 0);
    return { due, key: `once-${bill.id}` };
  }
  const f = new Date(from);
  f.setHours(0, 0, 0, 0);
  const due = new Date(f.getFullYear(), f.getMonth(), Math.min(bill.dueDay, daysInMonth(f.getFullYear(), f.getMonth())));
  return { due, key: monthKey(due) };
}

// All recorded paid amounts for a recurring bill, oldest first. Every time a
// bill is marked paid the actual amount charged that cycle is saved here, so
// this becomes a real history even for bills that don't change every month.
function billHistoryEntries(bill, data) {
  return Object.keys(data.billPayments)
    .filter((key) => !key.startsWith("once-"))
    .map((key) => ({ key, ...(data.billPayments[key]?.[bill.id] || {}) }))
    .filter((e) => e.paid && e.amount != null)
    .sort((a, b) => a.key.localeCompare(b.key));
}

const pctChange = (curr, prev) => (prev ? ((curr - prev) / prev) * 100 : null);
const fmtPct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });

function yearOverYearKey(key) {
  const [y, m] = key.split("-");
  return `${Number(y) - 1}-${m}`;
}

// Totals across ALL recurring bills for each month they were paid — a rough
// personal spend/inflation index independent of any single bill.
function monthlyBillTotals(data) {
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
function cardMonthlySpend(card, data) {
  const totals = {};
  data.cardTransactions.filter((t) => t.cardId === card.id && t.type === "charge").forEach((t) => {
    const key = monthKey(new Date(t.date));
    totals[key] = (totals[key] || 0) + Number(t.amount);
  });
  return Object.entries(totals).map(([key, amount]) => ({ key, amount })).sort((a, b) => a.key.localeCompare(b.key));
}

// Summary figures for any {key, amount} series, used across the global and
// drilled-down Analytics views.
function seriesStats(series) {
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

const toneWord = (v) => (v == null ? "ink" : v > 0 ? "rust" : v < 0 ? "bottle" : "ink");
const toneColor = (v) => (v == null ? "var(--ink-soft)" : v > 0 ? "var(--rust)" : v < 0 ? "var(--bottle)" : "var(--ink-soft)");

const CARD_COLORS = ["#2F4A3C", "#A33D2C", "#B8925A", "#3E5C76"];
const COLOR_BOTTLE = "#2F4A3C";
const COLOR_BRASS = "#B8925A";



const DEFAULT_DATA = { cards: [], bills: [], billPayments: {}, layaways: [], cardTransactions: [], bankAccounts: [], incomes: [] };

// A "charge" always increases what a credit card owes, but decreases what's
// left in a debit/checking account. A "payment" (paying down a card, or
// depositing to checking) does the opposite. This resolves the direction.
function signedAmount(card, type, amount) {
  const typeSign = type === "charge" ? 1 : -1;
  const cardSign = (card.type || "credit") === "debit" ? -1 : 1;
  return typeSign * cardSign * Number(amount);
}

function balanceTone(card, balance) {
  if ((card.type || "credit") === "debit") return balance < 0 ? "var(--rust)" : "var(--bottle)";
  return balance > 0 ? "var(--rust)" : "var(--bottle)";
}

function cardOptionLabel(c) {
  return `${c.name} · ${(c.type || "credit") === "debit" ? "Debit" : "Credit"}`;
}

const isEmptyData = (d) => d.cards.length === 0 && d.bills.length === 0 && d.layaways.length === 0;

function buildDemoData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const debitId = "demo-debit";
  const creditId = "demo-credit";

  const cards = [
    { id: debitId, name: "Everyday Checking", type: "debit", creditLimit: null, startingBalance: 1450.32, startingBalanceDate: iso(addDays(today, -5)) },
    { id: creditId, name: "Chase Sapphire", type: "credit", creditLimit: 8000, startingBalance: 620.15, startingBalanceDate: iso(addDays(today, -5)) },
  ];

  const phoneDueDay = Math.min(Math.max(today.getDate() - 3, 1), 27);
  const phoneDue = new Date(today.getFullYear(), today.getMonth(), phoneDueDay);

  const bills = [
    { id: "demo-bill-rent", name: "Rent", amount: 1450, cardId: debitId, frequency: "recurring", dueDay: 1 },
    { id: "demo-bill-electric", name: "Electric", amount: 102.75, cardId: creditId, frequency: "recurring", dueDay: 15 },
    { id: "demo-bill-internet", name: "Internet", amount: 65, cardId: creditId, frequency: "recurring", dueDay: 22 },
    { id: "demo-bill-phone", name: "Phone", amount: 55, cardId: creditId, frequency: "recurring", dueDay: phoneDueDay },
    { id: "demo-bill-registration", name: "Car registration renewal", amount: 180, cardId: creditId, frequency: "onetime", dueDate: iso(addDays(today, 20)) },
  ];

  // A few months of electric bill history (plus one from a year ago) so the
  // new bill-history and spending-trend views have something to show.
  const electricHistory = [13, 4, 3, 2, 1].map((monthsAgo, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 15);
    const amounts = [74.1, 88.2, 91.5, 95.0, 102.75];
    return { key: monthKey(d), date: iso(d), amount: amounts[i], txId: `demo-tx-electric-${i}` };
  });

  const billPayments = {
    [monthKey(phoneDue)]: {
      "demo-bill-phone": { paid: true, paidDate: iso(phoneDue), cardId: creditId, amount: 55, txId: "demo-tx-phone" },
    },
  };
  electricHistory.forEach((h) => {
    billPayments[h.key] = billPayments[h.key] || {};
    billPayments[h.key]["demo-bill-electric"] = { paid: true, paidDate: h.date, cardId: creditId, amount: h.amount, txId: h.txId };
  });

  const okeeInst1 = { id: "demo-fest-okee-inst1", amount: 160, dueDate: iso(addDays(today, -45)), paid: true, paidDate: iso(addDays(today, -45)), txId: "demo-tx-okee-1" };
  const okeeInst2 = { id: "demo-fest-okee-inst2", amount: 160, dueDate: iso(addDays(today, 6)), paid: false, paidDate: null, txId: null };
  const okeeInst3 = { id: "demo-fest-okee-inst3", amount: 160, dueDate: iso(addDays(today, 36)), paid: false, paidDate: null, txId: null };
  const okeeInst4 = { id: "demo-fest-okee-inst4", amount: 160, dueDate: iso(addDays(today, 66)), paid: false, paidDate: null, txId: null };

  const brooDeposit = { id: "demo-fest-broo-deposit", amount: 50, dueDate: iso(addDays(today, -30)), paid: true, paidDate: iso(addDays(today, -30)), txId: "demo-tx-broo-1" };
  const brooInst2 = { id: "demo-fest-broo-inst2", amount: 130, dueDate: iso(addDays(today, -3)), paid: false, paidDate: null, txId: null };
  const brooInst3 = { id: "demo-fest-broo-inst3", amount: 130, dueDate: iso(addDays(today, 25)), paid: false, paidDate: null, txId: null };
  const brooInst4 = { id: "demo-fest-broo-inst4", amount: 140, dueDate: iso(addDays(today, 55)), paid: false, paidDate: null, txId: null };

  const layaways = [
    {
      id: "demo-fest-okee",
      festivalName: "Okeechobee Music & Arts Festival",
      itemName: "GA + Camping Pass",
      ticketUrl: "https://tickets.okeechobeefest.com/account",
      eventDetails: "March 4–7, 2027 · Sunshine Grove, Okeechobee, FL",
      notes: "Splitting the cost with Jess — Venmo her half once each payment posts.",
      cardId: creditId,
      totalAmount: 640,
      installments: [okeeInst1, okeeInst2, okeeInst3, okeeInst4],
    },
    {
      id: "demo-fest-broo",
      festivalName: "Bonnaroo",
      itemName: "4-Day GA Ticket",
      ticketUrl: "https://my.bonnaroo.com/orders",
      eventDetails: "June 10–13, 2027 · Manchester, TN",
      notes: "Vendor's own plan: deposit, then three uneven payments per the checkout schedule.",
      cardId: debitId,
      totalAmount: 450,
      installments: [brooDeposit, brooInst2, brooInst3, brooInst4],
    },
  ];

  const cardTransactions = [
    { id: "demo-tx-phone", cardId: creditId, date: iso(phoneDue), amount: 55, type: "charge", description: "Phone", source: "bill", ref: "demo-bill-phone" },
    ...electricHistory.map((h) => ({ id: h.txId, cardId: creditId, date: h.date, amount: h.amount, type: "charge", description: "Electric", source: "bill", ref: "demo-bill-electric" })),
    { id: "demo-tx-okee-1", cardId: creditId, date: iso(addDays(today, -45)), amount: 160, type: "charge", description: "Okeechobee Music & Arts Festival payment", source: "layaway", ref: "demo-fest-okee-inst1" },
    { id: "demo-tx-broo-1", cardId: debitId, date: iso(addDays(today, -30)), amount: 50, type: "charge", description: "Bonnaroo payment", source: "layaway", ref: "demo-fest-broo-deposit" },
    { id: "demo-tx-groceries", cardId: debitId, date: iso(addDays(today, -1)), amount: 84.2, type: "charge", description: "Groceries", source: "manual" },
    { id: "demo-tx-paycheck", cardId: debitId, date: iso(addDays(today, -3)), amount: 1800, type: "payment", description: "Paycheck deposit", source: "manual" },
    { id: "demo-tx-cardpayment", cardId: creditId, date: iso(addDays(today, -2)), amount: 300, type: "payment", description: "Card payment", source: "manual" },
  ];

  const bankAccounts = [
    { id: "demo-acct-checking", name: "Main Checking", type: "checking", balance: 1450.32, updatedDate: iso(addDays(today, -1)) },
    { id: "demo-acct-savings", name: "Emergency Savings", type: "savings", balance: 4200.0, updatedDate: iso(addDays(today, -6)) },
  ];

  return { cards, bills, billPayments, layaways, cardTransactions, bankAccounts };
}

/* ---------------------------------- forecast ---------------------------------- */

function computeForecast(card, data, horizonDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const asOf = card.startingBalanceDate ? new Date(card.startingBalanceDate) : today;
  asOf.setHours(0, 0, 0, 0);

  let balance = Number(card.startingBalance) || 0;
  const txs = data.cardTransactions.filter((t) => t.cardId === card.id);

  txs.forEach((t) => {
    const td = new Date(t.date);
    if (td > asOf && td <= today) balance += signedAmount(card, t.type, t.amount);
  });

  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const events = [];

  txs.forEach((t) => {
    const td = new Date(t.date);
    if (td > today && td <= horizonEnd) {
      events.push({ date: td, delta: signedAmount(card, t.type, t.amount) });
    }
  });

  data.bills.filter((b) => b.cardId === card.id).forEach((b) => {
    if ((b.frequency || "recurring") === "onetime") {
      const due = new Date(b.dueDate);
      due.setHours(0, 0, 0, 0);
      const key = `once-${b.id}`;
      const payment = data.billPayments[key]?.[b.id];
      if (due >= today && due <= horizonEnd && !payment?.paid) {
        events.push({ date: due, delta: signedAmount(card, "charge", b.amount) });
      }
      return;
    }
    let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= horizonEnd) {
      const due = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(b.dueDay, daysInMonth(cursor.getFullYear(), cursor.getMonth())));
      const mk = monthKey(due);
      const payment = data.billPayments[mk]?.[b.id];
      if (due >= today && due <= horizonEnd && !payment?.paid) {
        events.push({ date: due, delta: signedAmount(card, "charge", b.amount) });
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  });

  data.layaways.filter((f) => f.cardId === card.id).forEach((f) => {
    f.installments.forEach((inst) => {
      const due = new Date(inst.dueDate);
      if (!inst.paid && due >= today && due <= horizonEnd) {
        events.push({ date: due, delta: signedAmount(card, "charge", inst.amount) });
      }
    });
  });

  events.sort((a, b) => a.date - b.date);

  const series = [{ x: today.getTime(), label: fmtDate(today), balance: Math.round(balance * 100) / 100 }];
  let running = balance;
  events.forEach((e) => {
    running += e.delta;
    series.push({ x: e.date.getTime(), label: fmtDate(e.date), balance: Math.round(running * 100) / 100 });
  });
  series.push({ x: horizonEnd.getTime(), label: fmtDate(horizonEnd), balance: Math.round(running * 100) / 100 });

  return series.map((p) => ({
    ...p,
    available: (card.type || "credit") === "credit" && card.creditLimit ? Math.round((card.creditLimit - p.balance) * 100) / 100 : null,
  }));
}

// Every occurrence of a recurring paycheck between today and the horizon end.
function incomeOccurrences(income, today, horizonEnd) {
  const step = (d) => {
    const nd = new Date(d);
    if (income.frequency === "weekly") nd.setDate(nd.getDate() + 7);
    else if (income.frequency === "biweekly") nd.setDate(nd.getDate() + 14);
    else nd.setMonth(nd.getMonth() + 1); // monthly
    return nd;
  };
  let d = new Date(income.startDate);
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (d < today && guard < 2000) { d = step(d); guard++; }
  const dates = [];
  while (d <= horizonEnd && guard < 4000) { dates.push(new Date(d)); d = step(d); guard++; }
  return dates;
}

// A mock, combined projection across one or more bank accounts: starting
// balance plus every scheduled paycheck (income) minus every upcoming unpaid
// bill and layaway installment, walked forward day by day. Every bill/layaway
// due date is treated as money leaving the account that day, regardless of
// which card it's charged to — a simplifying assumption for a "what will I
// have on hand" mock, not an exact statement-by-statement simulation.
function computeCashForecast(data, accountIds, horizonDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const accounts = (data.bankAccounts || []).filter((a) => accountIds.includes(a.id));
  const startingBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  const events = [];

  (data.incomes || []).filter((inc) => accountIds.includes(inc.accountId)).forEach((inc) => {
    incomeOccurrences(inc, today, horizonEnd).forEach((d) => {
      events.push({ date: d, amount: Number(inc.amount), label: inc.name, kind: "income" });
    });
  });

  data.bills.forEach((b) => {
    if ((b.frequency || "recurring") === "onetime") {
      const due = new Date(b.dueDate);
      due.setHours(0, 0, 0, 0);
      const payment = data.billPayments[`once-${b.id}`]?.[b.id];
      if (due >= today && due <= horizonEnd && !payment?.paid) events.push({ date: due, amount: -Number(b.amount), label: b.name, kind: "bill" });
      return;
    }
    let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= horizonEnd) {
      const due = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(b.dueDay, daysInMonth(cursor.getFullYear(), cursor.getMonth())));
      const payment = data.billPayments[monthKey(due)]?.[b.id];
      if (due >= today && due <= horizonEnd && !payment?.paid) events.push({ date: due, amount: -Number(b.amount), label: b.name, kind: "bill" });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  });

  data.layaways.forEach((f) => {
    f.installments.forEach((inst) => {
      const due = new Date(inst.dueDate);
      if (!inst.paid && due >= today && due <= horizonEnd) events.push({ date: due, amount: -Number(inst.amount), label: `${f.festivalName} payment`, kind: "layaway" });
    });
  });

  events.sort((a, b) => a.date - b.date);

  let running = startingBalance;
  const series = [{ x: today.getTime(), label: fmtDate(today), balance: Math.round(running * 100) / 100 }];
  const timeline = [];
  events.forEach((e) => {
    running += e.amount;
    const balanceAfter = Math.round(running * 100) / 100;
    series.push({ x: e.date.getTime(), label: fmtDate(e.date), balance: balanceAfter });
    timeline.push({ ...e, balanceAfter });
  });
  series.push({ x: horizonEnd.getTime(), label: fmtDate(horizonEnd), balance: Math.round(running * 100) / 100 });

  return {
    startingBalance,
    endingBalance: running,
    totalIncome: events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
    totalExpenses: events.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0),
    series,
    timeline,
  };
}

/* ---------------------------------- app ---------------------------------- */

export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("finance-data");
        if (r?.value) setData({ ...DEFAULT_DATA, ...JSON.parse(r.value) });
      } catch (e) {
        /* no saved data yet */
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set("finance-data", JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  const update = (fn) => setData((prev) => fn(structuredClone(prev)));

  const cardName = (id) => data.cards.find((c) => c.id === id)?.name || "—";
  const cardColor = (id) => {
    const idx = data.cards.findIndex((c) => c.id === id);
    return CARD_COLORS[idx % CARD_COLORS.length] || "var(--ink-soft)";
  };

  /* ---- bill actions ---- */
  const addBill = (bill) => update((d) => { d.bills.push({ id: uid(), ...bill }); return d; });
  const updateBill = (id, patch) => update((d) => {
    const b = d.bills.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return d;
  });
  const deleteBill = (id) => update((d) => {
    d.bills = d.bills.filter((b) => b.id !== id);
    const removedTxIds = [];
    Object.values(d.billPayments).forEach((m) => { if (m[id]?.txId) removedTxIds.push(m[id].txId); delete m[id]; });
    d.cardTransactions = d.cardTransactions.filter((t) => !removedTxIds.includes(t.id));
    return d;
  });

  const toggleBillPaid = (bill, key, checked, paidDate, cardId, amount) => update((d) => {
    d.billPayments[key] = d.billPayments[key] || {};
    const existing = d.billPayments[key][bill.id];
    if (checked) {
      if (existing?.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== existing.txId);
      const amt = amount != null && amount !== "" ? Number(amount) : Number(bill.amount);
      const txId = uid();
      if (cardId) {
        d.cardTransactions.push({ id: txId, cardId, date: paidDate, amount: amt, type: "charge", description: bill.name, source: "bill", ref: bill.id });
      }
      d.billPayments[key][bill.id] = { paid: true, paidDate, cardId, amount: amt, txId: cardId ? txId : null };
      // Keep the bill's default estimate current so next cycle starts from the latest known amount.
      const billRef = d.bills.find((b) => b.id === bill.id);
      if (billRef) billRef.amount = amt;
    } else {
      if (existing?.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== existing.txId);
      delete d.billPayments[key][bill.id];
    }
    return d;
  });

  /* ---- layaway actions ---- */
  const addFestival = (fest) => update((d) => { d.layaways.push({ id: uid(), ...fest }); return d; });
  const deleteFestival = (id) => update((d) => {
    const fest = d.layaways.find((f) => f.id === id);
    const instIds = fest ? fest.installments.map((i) => i.id) : [];
    d.cardTransactions = d.cardTransactions.filter((t) => !(t.source === "layaway" && instIds.includes(t.ref)));
    d.layaways = d.layaways.filter((f) => f.id !== id);
    return d;
  });
  const updateFestivalMeta = (id, patch) => update((d) => {
    const f = d.layaways.find((x) => x.id === id);
    if (f) Object.assign(f, patch);
    return d;
  });

  const toggleInstallmentPaid = (fest, inst, checked, paidDate) => update((d) => {
    const f = d.layaways.find((x) => x.id === fest.id);
    const i = f.installments.find((x) => x.id === inst.id);
    if (checked) {
      if (i.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== i.txId);
      const txId = uid();
      if (f.cardId) {
        d.cardTransactions.push({ id: txId, cardId: f.cardId, date: paidDate, amount: i.amount, type: "charge", description: `${f.festivalName} payment`, source: "layaway", ref: i.id });
      }
      i.paid = true; i.paidDate = paidDate; i.txId = f.cardId ? txId : null;
    } else {
      if (i.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== i.txId);
      i.paid = false; i.paidDate = null; i.txId = null;
    }
    return d;
  });

  const addInstallment = (festId, entry) => update((d) => {
    const f = d.layaways.find((x) => x.id === festId);
    f.installments.push({ id: uid(), amount: Number(entry.amount), dueDate: entry.dueDate, paid: false, paidDate: null, txId: null });
    return d;
  });
  const deleteInstallment = (festId, instId) => update((d) => {
    const f = d.layaways.find((x) => x.id === festId);
    const inst = f.installments.find((x) => x.id === instId);
    if (inst?.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== inst.txId);
    f.installments = f.installments.filter((x) => x.id !== instId);
    return d;
  });
  const updateInstallment = (festId, instId, patch) => update((d) => {
    const f = d.layaways.find((x) => x.id === festId);
    const inst = f.installments.find((x) => x.id === instId);
    Object.assign(inst, patch);
    if (inst.txId && patch.amount !== undefined) {
      const tx = d.cardTransactions.find((t) => t.id === inst.txId);
      if (tx) tx.amount = Number(patch.amount);
    }
    return d;
  });

  /* ---- card actions ---- */
  const addCard = (card) => update((d) => { d.cards.push({ id: uid(), ...card }); return d; });
  const deleteCard = (id) => update((d) => {
    d.cards = d.cards.filter((c) => c.id !== id);
    d.cardTransactions = d.cardTransactions.filter((t) => t.cardId !== id);
    return d;
  });
  const addTransaction = (cardId, tx) => update((d) => {
    d.cardTransactions.push({ id: uid(), cardId, source: "manual", ...tx });
    return d;
  });
  const deleteTransaction = (id) => update((d) => {
    const tx = d.cardTransactions.find((t) => t.id === id);
    d.cardTransactions = d.cardTransactions.filter((t) => t.id !== id);
    if (tx?.source === "bill") {
      Object.values(d.billPayments).forEach((m) => { Object.keys(m).forEach((bid) => { if (m[bid].txId === id) delete m[bid]; }); });
    }
    if (tx?.source === "layaway") {
      d.layaways.forEach((f) => f.installments.forEach((i) => { if (i.txId === id) { i.paid = false; i.paidDate = null; i.txId = null; } }));
    }
    return d;
  });

  /* ---- bank account actions ---- */
  const addBankAccount = (account) => update((d) => { d.bankAccounts.push({ id: uid(), ...account }); return d; });
  const updateBankAccount = (id, patch) => update((d) => {
    const a = d.bankAccounts.find((x) => x.id === id);
    if (a) Object.assign(a, patch);
    return d;
  });
  const deleteBankAccount = (id) => update((d) => { d.bankAccounts = d.bankAccounts.filter((a) => a.id !== id); return d; });

  /* ---- income (paycheck) actions ---- */
  const addIncome = (income) => update((d) => { d.incomes.push({ id: uid(), ...income }); return d; });
  const deleteIncome = (id) => update((d) => { d.incomes = d.incomes.filter((i) => i.id !== id); return d; });

  const loadDemo = () => setData(buildDemoData());
  const clearAll = () => {
    if (window.confirm("Clear all data and start fresh? This can't be undone.")) setData(structuredClone(DEFAULT_DATA));
  };

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "bills", label: "Bills", icon: Receipt },
    { id: "layaway", label: "Festival layaway", icon: Ticket },
    { id: "cards", label: "Card ledgers", icon: Wallet },
    { id: "accounts", label: "Bank Accounts", icon: Landmark },
    { id: "forecast", label: "Forecast", icon: TrendingUp },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="app">
      <Style />
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">§</span>
          <span className="brand-name">Align</span>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={"nav-item" + (tab === n.id ? " active" : "")} onClick={() => setTab(n.id)}>
              <n.icon size={16} strokeWidth={1.75} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="footer-link" onClick={loadDemo}><Sparkles size={13} /> Load demo data</button>
          <button className="footer-link" onClick={clearAll}><Eraser size={13} /> Clear all data</button>
        </div>
      </aside>

      <main className="main">
        {tab === "dashboard" && (
          <Dashboard data={data} cardName={cardName} cardColor={cardColor} toggleBillPaid={toggleBillPaid} toggleInstallmentPaid={toggleInstallmentPaid} loadDemo={loadDemo} addTransaction={addTransaction} />
        )}
        {tab === "bills" && (
          <BillsPage data={data} addBill={addBill} updateBill={updateBill} deleteBill={deleteBill} toggleBillPaid={toggleBillPaid} cardColor={cardColor} />
        )}
        {tab === "layaway" && (
          <LayawayPage
            data={data}
            addFestival={addFestival}
            deleteFestival={deleteFestival}
            updateFestivalMeta={updateFestivalMeta}
            toggleInstallmentPaid={toggleInstallmentPaid}
            addInstallment={addInstallment}
            deleteInstallment={deleteInstallment}
            updateInstallment={updateInstallment}
            cardColor={cardColor}
          />
        )}
        {tab === "cards" && (
          <CardsPage data={data} addCard={addCard} deleteCard={deleteCard} addTransaction={addTransaction} deleteTransaction={deleteTransaction} cardColor={cardColor} />
        )}
        {tab === "accounts" && (
          <BankAccountsPage data={data} addBankAccount={addBankAccount} updateBankAccount={updateBankAccount} deleteBankAccount={deleteBankAccount} />
        )}
        {tab === "forecast" && (
          <ForecastPage data={data} addIncome={addIncome} deleteIncome={deleteIncome} />
        )}
        {tab === "analytics" && <AnalyticsPage data={data} />}
      </main>
    </div>
  );
}

/* ---------------------------------- dashboard ---------------------------------- */

function Dashboard({ data, cardName, cardColor, toggleBillPaid, toggleInstallmentPaid, loadDemo, addTransaction }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + 14);
  const [modalOpen, setModalOpen] = useState(false);
  const empty = isEmptyData(data);

  const upcoming = useMemo(() => {
    const items = [];
    data.bills.forEach((b) => {
      const { due, key } = billDueInfo(b, today);
      const paid = data.billPayments[key]?.[b.id]?.paid;
      if (!paid && due <= horizon) items.push({ kind: "bill", ref: b, key, due, name: b.name, amount: b.amount, cardId: b.cardId });
    });
    data.layaways.forEach((f) => {
      f.installments.forEach((i) => {
        const due = new Date(i.dueDate);
        if (!i.paid && due <= horizon) items.push({ kind: "layaway", fest: f, inst: i, due, name: `${f.festivalName} · ${f.itemName || "installment"}`, amount: i.amount, cardId: f.cardId });
      });
    });
    return items.sort((a, b) => a.due - b.due);
  }, [data]);

  const unpaidTotal = useMemo(() => {
    return data.bills.reduce((sum, b) => {
      const { key } = billDueInfo(b, today);
      const paid = data.billPayments[key]?.[b.id]?.paid;
      return paid ? sum : sum + Number(b.amount);
    }, 0);
  }, [data]);

  const totalOwed = useMemo(() => {
    return data.cards.filter((c) => (c.type || "credit") === "credit").reduce((sum, c) => {
      const series = computeForecast(c, data, 1);
      return sum + (series[0]?.balance || 0);
    }, 0);
  }, [data]);

  const activeLayaways = data.layaways.filter((f) => f.installments.some((i) => !i.paid)).length;

  if (empty) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle={fmtDateLong(today)} />
        <Panel title="Nothing here yet">
          <p className="empty" style={{ marginBottom: 12 }}>
            Add your own bills, cards and festivals from the tabs on the left — or load sample content to see how the dashboard and layaway tiles work.
          </p>
          <button className="btn btn-primary" onClick={loadDemo}><Sparkles size={15} /> Load demo data</button>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={fmtDateLong(today)}
        action={
          data.cards.length > 0 && (
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add transaction</button>
          )
        }
      />

      <div className="stat-row">
        <Stat label="Owed on credit cards" value={money(totalOwed)} tone="rust" />
        <Stat label="Total unpaid bills" value={money(unpaidTotal)} tone="ink" />
        <Stat label="Active layaways" value={activeLayaways} tone="brass" />
      </div>

      <Panel title="Due in the next two weeks">
        {upcoming.length === 0 ? (
          <Empty text="Nothing due in the next 14 days. Add a bill or a festival payment to start tracking." />
        ) : (
          <div className="ledger">
            {upcoming.map((item, idx) => (
              <div className="ledger-row" key={idx}>
                <span className="dot" style={{ background: item.cardId ? cardColor(item.cardId) : "var(--line)" }} />
                <span className="col-name">{item.name}</span>
                <span className="col-card">{item.cardId ? cardName(item.cardId) : "no card set"}</span>
                <span className="col-date" style={{ color: item.due < today ? "var(--rust)" : "var(--ink-soft)" }}>{fmtDate(item.due)}</span>
                <span className="col-amount">{money(item.amount)}</span>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() =>
                    item.kind === "bill"
                      ? toggleBillPaid(item.ref, item.key, true, todayISO(), item.cardId)
                      : toggleInstallmentPaid(item.fest, item.inst, true, todayISO())
                  }
                >
                  <Check size={14} /> Mark paid
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {modalOpen && (
        <Modal title="Add transaction" onClose={() => setModalOpen(false)}>
          {data.cards.length === 0 ? (
            <p className="empty">Add a card first in Card ledgers.</p>
          ) : (
            <GlobalTransactionForm cards={data.cards} addTransaction={addTransaction} onDone={() => setModalOpen(false)} />
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------- bills page ---------------------------------- */

function BillsPage({ data, addBill, updateBill, deleteBill, toggleBillPaid, cardColor }) {
  const [adding, setAdding] = useState(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const sorted = useMemo(
    () => data.bills.slice().sort((a, b) => billDueInfo(a, today).due - billDueInfo(b, today).due),
    [data.bills]
  );

  return (
    <div>
      <PageHeader title="Bills" subtitle="Recurring and one-time bills" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add bill"}
        </button>
      } />

      {adding && <AddBillForm cards={data.cards} onAdd={(b) => { addBill(b); setAdding(false); }} />}

      <Panel title="All bills">
        {data.bills.length === 0 ? (
          <Empty text="No bills yet. Add your first bill — recurring or one-time — to start tracking payments." />
        ) : (
          <div className="ledger">
            {sorted.map((bill) => (
              <BillRow key={bill.id} bill={bill} data={data} toggleBillPaid={toggleBillPaid} updateBill={updateBill} deleteBill={deleteBill} cardColor={cardColor} />
            ))}
          </div>
        )}
      </Panel>
      <p className="page-footnote">Looking for spending trends and history? Check the <strong>Analytics</strong> tab.</p>
    </div>
  );
}

function BillRow({ bill, data, toggleBillPaid, updateBill, deleteBill, cardColor }) {
  const { due, key } = billDueInfo(bill);
  const payment = data.billPayments[key]?.[bill.id];
  const paid = !!payment?.paid;
  const overdue = !paid && due < new Date(todayISO());
  const isRecurring = (bill.frequency || "recurring") !== "onetime";
  const [editingPaid, setEditingPaid] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState(bill.amount);
  const [paidDate, setPaidDate] = useState(payment?.paidDate || todayISO());
  const [cardId, setCardId] = useState(payment?.cardId || bill.cardId || "");
  const [amount, setAmount] = useState(payment?.amount ?? bill.amount);

  const handleCheck = (e) => {
    toggleBillPaid(bill, key, e.target.checked, paidDate, cardId, amount);
    setEditingPaid(false);
  };

  const saveAmount = () => {
    const v = Number(amountDraft) || 0;
    updateBill(bill.id, { amount: v });
    setAmount(v);
    setEditingAmount(false);
  };

  const paidCardName = data.cards.find((c) => c.id === payment?.cardId)?.name;

  return (
    <div className="ledger-row wrap">
      <span className="dot" style={{ background: bill.cardId ? cardColor(bill.cardId) : "var(--line)" }} />
      <span className="col-name">
        {bill.name}
        <span className="freq-tag">{isRecurring ? "monthly" : "one-time"}</span>
      </span>
      <span className="col-date" style={{ color: overdue ? "var(--rust)" : "var(--ink-soft)" }}>due {fmtDate(due)}</span>
      <span className="col-amount">{money(bill.amount)}</span>

      {!paid && (
        <button type="button" className="icon-btn" onClick={() => { setAmountDraft(bill.amount); setEditingAmount((v) => !v); }} title={editingAmount ? "Cancel" : "Edit amount owed"}>
          {editingAmount ? <X size={13} /> : <Pencil size={13} />}
        </button>
      )}

      <label className="paid-toggle">
        <input type="checkbox" checked={paid} onChange={handleCheck} />
        <span className={paid ? "tag tag-paid" : "tag tag-unpaid"}>{paid ? "Paid" : overdue ? "Overdue" : "Unpaid"}</span>
      </label>

      {!paid && editingAmount && (
        <div className="paid-summary">
          <span>New amount owed:</span>
          <input type="number" step="0.01" className="input input-small col-amount-input" value={amountDraft} autoFocus onChange={(e) => setAmountDraft(e.target.value)} />
          <button type="button" className="icon-btn" onClick={saveAmount} title="Save"><Check size={14} /></button>
        </div>
      )}

      {paid && !editingPaid && (
        <div className="paid-summary">
          <span>{fmtDate(payment.paidDate)} · {money(payment.amount)} · {paidCardName || "no card noted"}</span>
          <button type="button" className="icon-btn" onClick={() => setEditingPaid(true)} title="Edit this payment"><Pencil size={13} /></button>
        </div>
      )}

      {paid && editingPaid && (
        <div className="paid-summary">
          <input type="date" className="input input-small" value={paidDate} onChange={(e) => { setPaidDate(e.target.value); toggleBillPaid(bill, key, true, e.target.value, cardId, amount); }} />
          <input type="number" step="0.01" className="input input-small col-amount-input" value={amount} onChange={(e) => { const v = e.target.value; setAmount(v); toggleBillPaid(bill, key, true, paidDate, cardId, v); }} />
          <select className="input input-small" value={cardId} onChange={(e) => { setCardId(e.target.value); toggleBillPaid(bill, key, true, paidDate, e.target.value, amount); }}>
            <option value="">no card</option>
            {data.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="icon-btn" onClick={() => setEditingPaid(false)} title="Lock in"><Check size={14} /></button>
        </div>
      )}

      <button className="icon-btn" onClick={() => deleteBill(bill.id)} title="Delete bill"><Trash2 size={14} /></button>
    </div>
  );
}

function AddBillForm({ cards, onAdd }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("recurring");
  const [dueDay, setDueDay] = useState("1");
  const [dueDate, setDueDate] = useState(todayISO());
  const [cardId, setCardId] = useState(cards[0]?.id || "");

  const submit = (e) => {
    e.preventDefault();
    if (!name || !amount) return;
    const bill = { name, amount: Number(amount), cardId, frequency };
    if (frequency === "recurring") bill.dueDay = Number(dueDay);
    else bill.dueDate = dueDate;
    onAdd(bill);
    setName(""); setAmount(""); setDueDay("1"); setDueDate(todayISO());
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Bill name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent, electric, internet…" /></Field>
        <Field label="Amount"><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Frequency">
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="recurring">Recurring monthly</option>
            <option value="onetime">One-time</option>
          </select>
        </Field>
        {frequency === "recurring" ? (
          <Field label="Due day of month"><input className="input" type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
        ) : (
          <Field label="Due date"><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        )}
        <Field label="Usually paid with">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">no card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
      </div>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add bill</button>
    </form>
  );
}

/* ---------------------------------- layaway page ---------------------------------- */

function LayawayPage({ data, addFestival, deleteFestival, updateFestivalMeta, toggleInstallmentPaid, addInstallment, deleteInstallment, updateInstallment, cardColor }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader title="Festival layaway" subtitle="Installment plans for festival tickets and gear" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add festival"}
        </button>
      } />

      {adding && <AddFestivalForm cards={data.cards} onAdd={(f) => { addFestival(f); setAdding(false); }} />}

      {data.layaways.length === 0 ? (
        <Panel title="Plans"><Empty text="No layaway plans yet. Add a festival to build a payment schedule." /></Panel>
      ) : (
        <div className="tile-grid">
          {data.layaways.map((fest) => (
            <FestivalTile
              key={fest.id}
              fest={fest}
              cards={data.cards}
              toggleInstallmentPaid={toggleInstallmentPaid}
              deleteFestival={deleteFestival}
              updateFestivalMeta={updateFestivalMeta}
              addInstallment={addInstallment}
              deleteInstallment={deleteInstallment}
              updateInstallment={updateInstallment}
              cardColor={cardColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FestivalTile({ fest, cards, toggleInstallmentPaid, deleteFestival, updateFestivalMeta, addInstallment, deleteInstallment, updateInstallment, cardColor }) {
  const [editing, setEditing] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const total = fest.installments.reduce((s, i) => s + Number(i.amount), 0);
  const paidTotal = fest.installments.filter((i) => i.paid).reduce((s, i) => s + Number(i.amount), 0);
  const pct = total ? Math.round((paidTotal / total) * 100) : 0;
  const tileColor = fest.cardId ? cardColor(fest.cardId) : "var(--brass)";

  return (
    <section className="event-tile" style={{ borderTopColor: tileColor }}>
      <div className="tile-head">
        <div>
          <h2 className="panel-title">{fest.festivalName}</h2>
          {fest.itemName && <p className="tile-sub">{fest.itemName}</p>}
        </div>
        <div className="tile-head-actions">
          <button className="icon-btn" onClick={() => setEditing((v) => !v)} title="Edit details">{editing ? <X size={14} /> : <Pencil size={14} />}</button>
          <button className="icon-btn" onClick={() => deleteFestival(fest.id)} title="Delete plan"><Trash2 size={14} /></button>
        </div>
      </div>

      {editing ? (
        <FestivalMetaForm fest={fest} cards={cards} onSave={(patch) => { updateFestivalMeta(fest.id, patch); setEditing(false); }} />
      ) : (
        <div className="tile-details">
          {fest.eventDetails && <p className="details-text">{fest.eventDetails}</p>}
          {fest.ticketUrl && (
            <a className="link-row" href={fest.ticketUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> Ticket manager
            </a>
          )}
          {fest.notes && <p className="muted-text">{fest.notes}</p>}
          <p className="muted-text">Card: {fest.cardId ? cards.find((c) => c.id === fest.cardId)?.name || "—" : "none set"}</p>
        </div>
      )}

      <div className="progress-row">
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: tileColor }} /></div>
        <span className="progress-label">{money(paidTotal)} of {money(total)} paid</span>
      </div>

      <div className="ledger">
        {fest.installments.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((inst) => (
          <InstallmentRow key={inst.id} fest={fest} inst={inst} toggleInstallmentPaid={toggleInstallmentPaid} deleteInstallment={deleteInstallment} updateInstallment={updateInstallment} color={tileColor} />
        ))}
      </div>

      {addingPayment ? (
        <AddInstallmentForm onAdd={(entry) => { addInstallment(fest.id, entry); setAddingPayment(false); }} onCancel={() => setAddingPayment(false)} />
      ) : (
        <button className="btn btn-ghost btn-small" style={{ marginTop: 10 }} onClick={() => setAddingPayment(true)}>
          <Plus size={14} /> Add payment
        </button>
      )}
    </section>
  );
}

function InstallmentRow({ fest, inst, toggleInstallmentPaid, deleteInstallment, updateInstallment, color }) {
  const [amount, setAmount] = useState(inst.amount);
  const [dueDate, setDueDate] = useState(inst.dueDate?.slice(0, 10) || inst.dueDate);

  return (
    <div className="ledger-row wrap">
      <span className="dot" style={{ background: color }} />
      <input
        className="input input-small col-date-input"
        type="date"
        value={dueDate}
        disabled={inst.paid}
        onChange={(e) => { setDueDate(e.target.value); updateInstallment(fest.id, inst.id, { dueDate: e.target.value }); }}
      />
      <input
        className="input input-small col-amount-input"
        type="number"
        step="0.01"
        value={amount}
        disabled={inst.paid}
        onChange={(e) => { setAmount(e.target.value); updateInstallment(fest.id, inst.id, { amount: Number(e.target.value) || 0 }); }}
      />
      <label className="paid-toggle">
        <input type="checkbox" checked={!!inst.paid} onChange={(e) => toggleInstallmentPaid(fest, inst, e.target.checked, todayISO())} />
        <span className={inst.paid ? "tag tag-paid" : "tag tag-unpaid"}>{inst.paid ? "Paid" : "Unpaid"}</span>
      </label>
      <button className="icon-btn" onClick={() => deleteInstallment(fest.id, inst.id)} title="Delete payment"><Trash2 size={14} /></button>
    </div>
  );
}

function AddInstallmentForm({ onAdd, onCancel }) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const submit = (e) => {
    e.preventDefault();
    if (!amount || !dueDate) return;
    onAdd({ amount, dueDate });
  };
  return (
    <form className="add-row-form" onSubmit={submit}>
      <input className="input input-small" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <input className="input input-small" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button className="btn btn-primary btn-small" type="submit"><Plus size={13} /> Add</button>
      <button className="btn btn-ghost btn-small" type="button" onClick={onCancel}><X size={13} /></button>
    </form>
  );
}

function FestivalMetaForm({ fest, cards, onSave }) {
  const [festivalName, setFestivalName] = useState(fest.festivalName);
  const [itemName, setItemName] = useState(fest.itemName || "");
  const [ticketUrl, setTicketUrl] = useState(fest.ticketUrl || "");
  const [eventDetails, setEventDetails] = useState(fest.eventDetails || "");
  const [notes, setNotes] = useState(fest.notes || "");
  const [cardId, setCardId] = useState(fest.cardId || "");

  const submit = (e) => {
    e.preventDefault();
    onSave({ festivalName, itemName, ticketUrl, eventDetails, notes, cardId });
  };

  return (
    <form className="edit-form" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Festival name"><input className="input" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} /></Field>
        <Field label="Item"><input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} /></Field>
        <Field label="Ticket manager URL"><input className="input" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="Card">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">no card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Event details"><textarea className="input textarea" value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Dates, venue, lineup notes…" /></Field>
      <Field label="Notes"><textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth keeping track of…" /></Field>
      <button className="btn btn-primary btn-small" type="submit" style={{ marginTop: 4 }}><Check size={14} /> Save details</button>
    </form>
  );
}

function AddFestivalForm({ cards, onAdd }) {
  const [festivalName, setFestivalName] = useState("");
  const [itemName, setItemName] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [cardId, setCardId] = useState(cards[0]?.id || "");

  const [mode, setMode] = useState("auto"); // 'auto' | 'preset'

  // auto-split fields
  const [totalAmount, setTotalAmount] = useState("");
  const [numPayments, setNumPayments] = useState("4");
  const [firstDue, setFirstDue] = useState(todayISO());
  const [interval, setInterval_] = useState("monthly");

  // preset schedule rows
  const [rows, setRows] = useState([{ amount: "", dueDate: todayISO() }]);
  const updateRow = (idx, patch) => setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const addRow = () => setRows((r) => [...r, { amount: "", dueDate: todayISO() }]);
  const removeRow = (idx) => setRows((r) => r.filter((_, i) => i !== idx));

  const submit = (e) => {
    e.preventDefault();
    if (!festivalName) return;

    let installments = [];
    if (mode === "auto") {
      if (!totalAmount || !numPayments) return;
      const n = Number(numPayments);
      const total = Number(totalAmount);
      const base = Math.floor((total / n) * 100) / 100;
      const remainder = Math.round((total - base * n) * 100) / 100;
      let d = new Date(firstDue);
      for (let i = 0; i < n; i++) {
        const amt = i === n - 1 ? base + remainder : base;
        installments.push({ id: uid(), amount: amt, dueDate: d.toISOString().slice(0, 10), paid: false, paidDate: null, txId: null });
        d = new Date(d);
        if (interval === "weekly") d.setDate(d.getDate() + 7);
        else if (interval === "biweekly") d.setDate(d.getDate() + 14);
        else d.setMonth(d.getMonth() + 1);
      }
    } else {
      installments = rows
        .filter((r) => r.amount && r.dueDate)
        .map((r) => ({ id: uid(), amount: Number(r.amount), dueDate: r.dueDate, paid: false, paidDate: null, txId: null }));
      if (installments.length === 0) return;
    }

    const total = installments.reduce((s, i) => s + i.amount, 0);
    onAdd({ festivalName, itemName, ticketUrl, eventDetails, notes, cardId, totalAmount: total, installments });
    setFestivalName(""); setItemName(""); setTicketUrl(""); setEventDetails(""); setNotes("");
    setTotalAmount(""); setNumPayments("4"); setFirstDue(todayISO()); setRows([{ amount: "", dueDate: todayISO() }]);
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Festival name"><input className="input" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} placeholder="e.g. Okeechobee" /></Field>
        <Field label="Item (optional)"><input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="GA ticket, camping…" /></Field>
        <Field label="Ticket manager URL (optional)"><input className="input" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="Card">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">no card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Event details (optional)"><textarea className="input textarea" value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Dates, venue, lineup notes…" /></Field>
      <Field label="Notes (optional)"><textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth keeping track of…" /></Field>

      <div className="segmented" style={{ margin: "14px 0 12px" }}>
        <button type="button" className={"segment" + (mode === "auto" ? " active" : "")} onClick={() => setMode("auto")}>Auto-split evenly</button>
        <button type="button" className={"segment" + (mode === "preset" ? " active" : "")} onClick={() => setMode("preset")}>Vendor's payment schedule</button>
      </div>

      {mode === "auto" ? (
        <div className="form-grid">
          <Field label="Total amount"><input className="input" type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Number of payments"><input className="input" type="number" min="1" value={numPayments} onChange={(e) => setNumPayments(e.target.value)} /></Field>
          <Field label="First payment date"><input className="input" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></Field>
          <Field label="Frequency">
            <select className="input" value={interval} onChange={(e) => setInterval_(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
        </div>
      ) : (
        <div>
          <p className="hint" style={{ marginTop: 0 }}>Enter the exact amount and date for each payment from the vendor's plan.</p>
          {rows.map((row, idx) => (
            <div className="add-row-form" key={idx}>
              <input className="input input-small" type="date" value={row.dueDate} onChange={(e) => updateRow(idx, { dueDate: e.target.value })} />
              <input className="input input-small" type="number" step="0.01" placeholder="0.00" value={row.amount} onChange={(e) => updateRow(idx, { amount: e.target.value })} />
              {rows.length > 1 && <button type="button" className="icon-btn" onClick={() => removeRow(idx)}><Trash2 size={14} /></button>}
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-small" onClick={addRow}><Plus size={13} /> Add another payment</button>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary" type="submit"><Plus size={15} /> Create plan</button>
      </div>
    </form>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2 className="panel-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GlobalTransactionForm({ cards, addTransaction, onDone }) {
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("charge");
  const [date, setDate] = useState(todayISO());
  const card = cards.find((c) => c.id === cardId);
  const isDebit = card && (card.type || "credit") === "debit";

  const submit = (e) => {
    e.preventDefault();
    if (!cardId || !description || !amount) return;
    addTransaction(cardId, { description, amount: Number(amount), type, date });
    onDone();
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Card">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
        <Field label="Amount"><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="charge">{isDebit ? "Charge (money out)" : "Charge (adds to balance)"}</option>
            <option value="payment">{isDebit ? "Deposit (money in)" : "Payment (reduces balance)"}</option>
          </select>
        </Field>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, card payment, paycheck…" /></Field>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add transaction</button>
    </form>
  );
}

/* ---------------------------------- cards page ---------------------------------- */

function CardsPage({ data, addCard, deleteCard, addTransaction, deleteTransaction, cardColor }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader title="Card ledgers" subtitle="Balances, transactions and forecasts per card" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add card"}
        </button>
      } />

      {adding && <AddCardForm onAdd={(c) => { addCard(c); setAdding(false); }} />}

      {data.cards.length === 0 ? (
        <Panel title="Cards"><Empty text="No cards yet. Add a credit or debit card to start a running ledger and forecast." /></Panel>
      ) : (
        data.cards.map((c) => (
          <CardLedgerPanel key={c.id} card={c} data={data} addTransaction={addTransaction} deleteTransaction={deleteTransaction} deleteCard={deleteCard} color={cardColor(c.id)} />
        ))
      )}
    </div>
  );
}

function AddCardForm({ onAdd }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("credit");
  const [creditLimit, setCreditLimit] = useState("");
  const [startingBalance, setStartingBalance] = useState("0");
  const [startingBalanceDate, setStartingBalanceDate] = useState(todayISO());

  const submit = (e) => {
    e.preventDefault();
    if (!name) return;
    onAdd({
      name,
      type,
      creditLimit: type === "credit" && creditLimit ? Number(creditLimit) : null,
      startingBalance: Number(startingBalance) || 0,
      startingBalanceDate,
    });
    setName(""); setCreditLimit(""); setStartingBalance("0");
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Card name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chase Sapphire" /></Field>
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="credit">Credit card</option>
            <option value="debit">Debit card</option>
          </select>
        </Field>
        {type === "credit" && (
          <Field label="Credit limit (optional)"><input className="input" type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0.00" /></Field>
        )}
        <Field label={type === "credit" ? "Current balance owed" : "Current account balance"}>
          <input className="input" type="number" step="0.01" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
        </Field>
        <Field label="As of date"><input className="input" type="date" value={startingBalanceDate} onChange={(e) => setStartingBalanceDate(e.target.value)} /></Field>
      </div>
      <p className="hint">
        {type === "credit"
          ? "Enter what you currently owe on the card. Charges add to the balance; payments reduce it."
          : "Enter the balance sitting in the account. Charges subtract from it; deposits add to it."}
      </p>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add card</button>
    </form>
  );
}

function CardLedgerPanel({ card, data, addTransaction, deleteTransaction, deleteCard, color }) {
  const [showForm, setShowForm] = useState(false);
  const isDebit = (card.type || "credit") === "debit";
  const series = computeForecast(card, data, 1);
  const balance = series[0]?.balance || 0;
  const txs = data.cardTransactions.filter((t) => t.cardId === card.id).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <Panel
      title={
        <span>
          {card.name} <span className={"tag " + (isDebit ? "tag-debit" : "tag-credit")}>{isDebit ? "Debit" : "Credit"}</span>
        </span>
      }
      right={<button className="icon-btn" onClick={() => deleteCard(card.id)} title="Delete card"><Trash2 size={14} /></button>}
    >
      <div className="forecast-figures">
        <div>
          <div className="figure-label">{isDebit ? "Account balance" : "Current balance"}</div>
          <div className="figure-value" style={{ color: balanceTone(card, balance) }}>{money(balance)}</div>
        </div>
        {!isDebit && card.creditLimit ? (
          <div>
            <div className="figure-label">Available credit</div>
            <div className="figure-value">{money(card.creditLimit - balance)}</div>
          </div>
        ) : null}
      </div>

      <button className="btn btn-ghost btn-small" style={{ marginBottom: 12 }} onClick={() => setShowForm((v) => !v)}>
        {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Close" : "Add transaction"}
      </button>

      {showForm && <TransactionForm card={card} onAdd={(tx) => { addTransaction(card.id, tx); setShowForm(false); }} />}

      {txs.length === 0 ? (
        <Empty text="No transactions yet. Paid bills and layaway installments assigned to this card will show up here automatically." />
      ) : (
        <div className="ledger">
          {txs.map((t) => (
            <div className="ledger-row" key={t.id}>
              <span className="dot" style={{ background: t.type === "charge" ? "var(--rust)" : "var(--bottle)" }} />
              <span className="col-name">{t.description}</span>
              <span className="col-date">{fmtDate(t.date)}</span>
              <span className="col-amount" style={{ color: t.type === "charge" ? "var(--rust)" : "var(--bottle)" }}>
                {t.type === "charge" ? "−" : "+"}{money(t.amount)}
              </span>
              <button className="icon-btn" onClick={() => deleteTransaction(t.id)} title="Delete"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function TransactionForm({ card, onAdd }) {
  const isDebit = (card.type || "credit") === "debit";
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("charge");
  const [date, setDate] = useState(todayISO());

  const submit = (e) => {
    e.preventDefault();
    if (!description || !amount) return;
    onAdd({ description, amount: Number(amount), type, date });
    setDescription(""); setAmount("");
  };

  return (
    <form className="panel form-panel form-panel-tight" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, card payment…" /></Field>
        <Field label="Amount"><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="charge">{isDebit ? "Charge (money out)" : "Charge (adds to balance)"}</option>
            <option value="payment">{isDebit ? "Deposit (money in)" : "Payment (reduces balance)"}</option>
          </select>
        </Field>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add transaction</button>
    </form>
  );
}

/* ---------------------------------- bank accounts page ---------------------------------- */

function BankAccountsPage({ data, addBankAccount, updateBankAccount, deleteBankAccount }) {
  const [adding, setAdding] = useState(false);
  const accounts = data.bankAccounts || [];
  const totalChecking = accounts.filter((a) => a.type !== "savings").reduce((s, a) => s + Number(a.balance), 0);
  const totalSavings = accounts.filter((a) => a.type === "savings").reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div>
      <PageHeader title="Bank Accounts" subtitle="Checking and savings balances" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add account"}
        </button>
      } />

      {adding && <AddAccountForm onAdd={(a) => { addBankAccount(a); setAdding(false); }} />}

      {accounts.length > 0 && (
        <div className="stat-row">
          <Stat label="Total checking" value={money(totalChecking)} tone="ink" />
          <Stat label="Total savings" value={money(totalSavings)} tone="brass" />
          <Stat label="Combined" value={money(totalChecking + totalSavings)} tone="bottle" />
        </div>
      )}

      <Panel title="Accounts">
        {accounts.length === 0 ? (
          <Empty text="No accounts yet. Add a checking or savings account to start tracking balances." />
        ) : (
          <div className="ledger">
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} updateBankAccount={updateBankAccount} deleteBankAccount={deleteBankAccount} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function AccountRow({ account, updateBankAccount, deleteBankAccount }) {
  const [editing, setEditing] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState(account.balance);
  const [dateDraft, setDateDraft] = useState(account.updatedDate || todayISO());
  const isSavings = account.type === "savings";

  const save = () => {
    updateBankAccount(account.id, { balance: Number(balanceDraft) || 0, updatedDate: dateDraft });
    setEditing(false);
  };

  return (
    <div className="ledger-row wrap">
      <span className="dot" style={{ background: isSavings ? "var(--brass)" : "var(--bottle)" }} />
      <span className="col-name">
        {account.name}
        <span className={"tag " + (isSavings ? "tag-debit" : "tag-credit")}>{isSavings ? "Savings" : "Checking"}</span>
      </span>

      {!editing && (
        <>
          <span className="col-date" style={{ width: 120 }}>{account.updatedDate ? `as of ${fmtDate(account.updatedDate)}` : "—"}</span>
          <span className="col-amount">{money(account.balance)}</span>
          <button type="button" className="icon-btn" onClick={() => { setBalanceDraft(account.balance); setDateDraft(account.updatedDate || todayISO()); setEditing(true); }} title="Update balance">
            <Pencil size={13} />
          </button>
        </>
      )}

      {editing && (
        <div className="paid-summary">
          <input type="number" step="0.01" className="input input-small col-amount-input" value={balanceDraft} autoFocus onChange={(e) => setBalanceDraft(e.target.value)} />
          <input type="date" className="input input-small" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
          <button type="button" className="icon-btn" onClick={save} title="Save"><Check size={14} /></button>
          <button type="button" className="icon-btn" onClick={() => setEditing(false)} title="Cancel"><X size={14} /></button>
        </div>
      )}

      <button className="icon-btn" onClick={() => deleteBankAccount(account.id)} title="Delete account"><Trash2 size={14} /></button>
    </div>
  );
}

function AddAccountForm({ onAdd }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [balance, setBalance] = useState("0");
  const [updatedDate, setUpdatedDate] = useState(todayISO());

  const submit = (e) => {
    e.preventDefault();
    if (!name) return;
    onAdd({ name, type, balance: Number(balance) || 0, updatedDate });
    setName(""); setBalance("0");
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Account name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Checking" /></Field>
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
          </select>
        </Field>
        <Field label="Current balance"><input className="input" type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
        <Field label="As of date"><input className="input" type="date" value={updatedDate} onChange={(e) => setUpdatedDate(e.target.value)} /></Field>
      </div>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add account</button>
    </form>
  );
}

/* ---------------------------------- forecast page ---------------------------------- */

function ForecastPage({ data, addIncome, deleteIncome }) {
  const accounts = data.bankAccounts || [];
  const incomes = data.incomes || [];
  const [selectedIds, setSelectedIds] = useState(accounts.map((a) => a.id));
  const [horizonDays, setHorizonDays] = useState(90);
  const [addingIncome, setAddingIncome] = useState(false);

  useEffect(() => {
    setSelectedIds((prev) => {
      const stillValid = prev.filter((id) => accounts.some((a) => a.id === id));
      return stillValid.length > 0 || accounts.length === 0 ? stillValid : accounts.map((a) => a.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const toggleAccount = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const result = useMemo(
    () => (selectedIds.length > 0 ? computeCashForecast(data, selectedIds, horizonDays) : null),
    [data, selectedIds, horizonDays]
  );

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Forecast" subtitle="Mock your ledger forward through upcoming paychecks and bills" />
        <Panel title="Add a bank account first">
          <Empty text="The forecast projects your bank account balances forward. Add a checking or savings account on the Bank Accounts tab to get started." />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Forecast" subtitle="Mock your ledger forward through upcoming paychecks and bills" />

      <Panel title="Included accounts">
        <div className="check-list">
          {accounts.map((a) => (
            <label className="check-item" key={a.id}>
              <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleAccount(a.id)} />
              <span>{a.name}</span>
              <span className="muted-text">{money(a.balance)}</span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Paychecks & recurring income" right={
        <button className="btn btn-primary btn-small" onClick={() => setAddingIncome((v) => !v)}>
          {addingIncome ? <X size={13} /> : <Plus size={13} />} {addingIncome ? "Close" : "Add income"}
        </button>
      }>
        {addingIncome && <AddIncomeForm accounts={accounts} onAdd={(i) => { addIncome(i); setAddingIncome(false); }} />}
        {incomes.length === 0 ? (
          <Empty text="No recurring income yet. Add your paycheck schedule so the forecast can add it in." />
        ) : (
          <div className="ledger">
            {incomes.map((inc) => (
              <IncomeRow key={inc.id} income={inc} accounts={accounts} deleteIncome={deleteIncome} />
            ))}
          </div>
        )}
      </Panel>

      {!result ? (
        <Panel title="Projected balance"><Empty text="Select at least one account above to see a projection." /></Panel>
      ) : (
        <>
          <Panel
            title="Projected balance"
            right={
              <div className="segmented">
                {[30, 60, 90, 180].map((h) => (
                  <button key={h} className={"segment" + (horizonDays === h ? " active" : "")} onClick={() => setHorizonDays(h)}>{h}d</button>
                ))}
              </div>
            }
          >
            <div className="stat-row" style={{ marginBottom: 16 }}>
              <Stat label="Starting balance" value={money(result.startingBalance)} tone="ink" />
              <Stat label={`Balance in ${horizonDays} days`} value={money(result.endingBalance)} tone={result.endingBalance >= result.startingBalance ? "bottle" : "rust"} />
              <Stat label="Projected income" value={money(result.totalIncome)} tone="bottle" />
              <Stat label="Projected bills & payments" value={money(Math.abs(result.totalExpenses))} tone="rust" />
            </div>
            <CashForecastChart series={result.series} />
            <p className="hint" style={{ marginTop: 4 }}>
              Assumes every bill and layaway payment leaves your account on its due date, and includes only the recurring income you've added above.
            </p>
          </Panel>

          <Panel title="Timeline">
            {result.timeline.length === 0 ? (
              <Empty text="Nothing scheduled in this window besides your starting balance." />
            ) : (
              <div className="ledger">
                {result.timeline.map((e, idx) => (
                  <div className="ledger-row" key={idx}>
                    <span className="dot" style={{ background: e.kind === "income" ? "var(--bottle)" : "var(--rust)" }} />
                    <span className="col-name">{e.label}</span>
                    <span className="col-date">{fmtDate(e.date)}</span>
                    <span className="col-amount" style={{ color: e.kind === "income" ? "var(--bottle)" : "var(--rust)" }}>
                      {e.amount > 0 ? "+" : "−"}{money(Math.abs(e.amount))}
                    </span>
                    <span className="col-balance">{money(e.balanceAfter)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function CashForecastChart({ series }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_BOTTLE} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COLOR_BOTTLE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={30} />
          <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`} width={52} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12 }}
            formatter={(v) => [money(v), "Balance"]}
          />
          <Area type="stepAfter" dataKey="balance" stroke={COLOR_BOTTLE} strokeWidth={2} fill="url(#forecast-grad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function IncomeRow({ income, accounts, deleteIncome }) {
  const accountName = accounts.find((a) => a.id === income.accountId)?.name || "no account";
  const freqLabel = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly" }[income.frequency] || income.frequency;
  return (
    <div className="ledger-row">
      <span className="dot" style={{ background: "var(--bottle)" }} />
      <span className="col-name">{income.name}</span>
      <span className="col-card">{accountName}</span>
      <span className="col-date" style={{ width: 100 }}>{freqLabel}</span>
      <span className="col-amount">{money(income.amount)}</span>
      <button className="icon-btn" onClick={() => deleteIncome(income.id)} title="Delete income"><Trash2 size={14} /></button>
    </div>
  );
}

function AddIncomeForm({ accounts, onAdd }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [frequency, setFrequency] = useState("biweekly");
  const [startDate, setStartDate] = useState(todayISO());

  const submit = (e) => {
    e.preventDefault();
    if (!name || !amount || !accountId) return;
    onAdd({ name, amount: Number(amount), accountId, frequency, startDate });
    setName(""); setAmount("");
  };

  return (
    <form className="panel form-panel form-panel-tight" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paycheck" /></Field>
        <Field label="Amount"><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Deposit account">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Frequency">
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Next pay date"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
      </div>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add income</button>
    </form>
  );
}

/* ---------------------------------- analytics page ---------------------------------- */

function AnalyticsPage({ data }) {
  const [drillMode, setDrillMode] = useState("bill"); // 'bill' | 'card'
  const [selectedId, setSelectedId] = useState(null);

  const globalSeries = useMemo(() => monthlyBillTotals(data), [data]);
  const globalStats = useMemo(() => seriesStats(globalSeries), [globalSeries]);

  const billOptions = useMemo(
    () =>
      data.bills
        .filter((b) => (b.frequency || "recurring") !== "onetime")
        .map((b) => ({ id: b.id, label: b.name, series: billHistoryEntries(b, data) }))
        .filter((o) => o.series.length > 0),
    [data]
  );
  const cardOptions = useMemo(
    () =>
      data.cards
        .map((c) => ({ id: c.id, label: c.name, series: cardMonthlySpend(c, data) }))
        .filter((o) => o.series.length > 0),
    [data]
  );
  const options = drillMode === "bill" ? billOptions : cardOptions;

  useEffect(() => {
    if (!options.some((o) => o.id === selectedId)) setSelectedId(options[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillMode, data]);

  const selected = options.find((o) => o.id === selectedId);
  const selectedStats = selected ? seriesStats(selected.series) : null;

  if (globalSeries.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="How your bills and spending change over time" />
        <Panel title="Not enough data yet">
          <Empty text="Mark a few bills paid across a couple of months and your spending trends will show up here." />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Analytics" subtitle="How your bills and spending change over time" />

      <div className="stat-row">
        <Stat label="Latest month, all bills" value={money(globalStats.latest.amount)} tone="ink" />
        <Stat label="Month over month" value={fmtPct(globalStats.mom)} tone={toneWord(globalStats.mom)} />
        <Stat label="Year over year" value={globalStats.yoy != null ? fmtPct(globalStats.yoy) : "not enough data yet"} tone={toneWord(globalStats.yoy)} />
      </div>

      <Panel title="All bills combined" right={<span className="muted-text">total recorded bills, by month paid</span>}>
        <TrendChart series={globalSeries} color={COLOR_BOTTLE} />
        <TrendTable series={globalSeries} />
      </Panel>

      <Panel
        title="Drill into a bill or card"
        right={
          <div className="segmented">
            <button className={"segment" + (drillMode === "bill" ? " active" : "")} onClick={() => setDrillMode("bill")}>By bill</button>
            <button className={"segment" + (drillMode === "card" ? " active" : "")} onClick={() => setDrillMode("card")}>By card</button>
          </div>
        }
      >
        {options.length === 0 ? (
          <Empty text={drillMode === "bill" ? "No recurring bill has more than one recorded payment yet." : "No card has recorded charges yet."} />
        ) : (
          <>
            <div className="chip-row">
              {options.map((o) => (
                <button key={o.id} className={"chip" + (o.id === selectedId ? " active" : "")} onClick={() => setSelectedId(o.id)}>{o.label}</button>
              ))}
            </div>

            {selected && selectedStats && (
              <div className="drill-body">
                <div className="drill-stats">
                  <div><div className="figure-label">Average</div><div className="drill-figure">{money(selectedStats.avg)}</div></div>
                  <div><div className="figure-label">Lowest</div><div className="drill-figure">{money(selectedStats.min)}</div></div>
                  <div><div className="figure-label">Highest</div><div className="drill-figure">{money(selectedStats.max)}</div></div>
                  <div><div className="figure-label">Month over month</div><div className="drill-figure" style={{ color: toneColor(selectedStats.mom) }}>{fmtPct(selectedStats.mom)}</div></div>
                  <div><div className="figure-label">Year over year</div><div className="drill-figure" style={{ color: toneColor(selectedStats.yoy) }}>{selectedStats.yoy != null ? fmtPct(selectedStats.yoy) : "—"}</div></div>
                </div>
                <TrendChart series={selected.series} color={COLOR_BRASS} />
                <TrendTable series={selected.series} />
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function TrendChart({ series, color }) {
  const chartData = series.map((e) => ({ label: monthLabel(e.key), amount: e.amount }));
  return (
    <div style={{ width: "100%", height: 200, marginBottom: 14 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={20} />
          <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12 }}
            formatter={(v) => [money(v), "Amount"]}
          />
          <Bar dataKey="amount" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTable({ series }) {
  return (
    <div className="ledger">
      {series.map((e, idx) => {
        const prev = series[idx - 1];
        const mom = prev ? pctChange(e.amount, prev.amount) : null;
        const yoyEntry = series.find((h) => h.key === yearOverYearKey(e.key));
        const yoy = yoyEntry ? pctChange(e.amount, yoyEntry.amount) : null;
        return (
          <div className="ledger-row" key={e.key}>
            <span className="col-name">{monthLabel(e.key)}</span>
            <span className="col-amount" style={{ width: 90 }}>{money(e.amount)}</span>
            <span className="history-change" style={{ color: toneColor(mom) }}>{mom == null ? "first on record" : `${fmtPct(mom)} mo/mo`}</span>
            <span className="history-change" style={{ color: toneColor(yoy) }}>{yoy != null ? `${fmtPct(yoy)} yr/yr` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- shared ui ---------------------------------- */

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Panel({ title, right, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color: `var(--${tone})` }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Empty({ text }) {
  return <p className="empty">{text}</p>;
}

/* ---------------------------------- styles ---------------------------------- */

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

      :root {
        --paper: #E8EDE3;
        --panel: #F7F5EF;
        --ink: #1F2E23;
        --ink-soft: #5B6B5E;
        --bottle: #2F4A3C;
        --rust: #A33D2C;
        --brass: #B8925A;
        --line: #CBD3C3;
      }

      * { box-sizing: border-box; }

      .app {
        display: flex;
        min-height: 100%;
        background: var(--paper);
        color: var(--ink);
        font-family: 'IBM Plex Sans', sans-serif;
        font-variant-numeric: tabular-nums;
        overflow-x: hidden;
      }

      .sidebar {
        width: 208px;
        flex-shrink: 0;
        background: var(--paper);
        border-right: 1px solid var(--line);
        padding: 24px 14px;
      }

      .brand {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 0 10px 20px;
        margin-bottom: 12px;
        border-bottom: 1px solid var(--line);
      }
      .brand-mark { font-family: 'Source Serif 4', serif; font-size: 22px; color: var(--brass); }
      .brand-name { font-family: 'Source Serif 4', serif; font-size: 18px; font-weight: 600; letter-spacing: 0.2px; }

      nav { display: flex; flex-direction: column; gap: 2px; }

      .nav-item {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 10px; border: none; background: transparent;
        border-left: 2px solid transparent; color: var(--ink-soft);
        font-family: inherit; font-size: 13.5px; text-align: left;
        cursor: pointer; border-radius: 0 3px 3px 0;
      }
      .nav-item:hover { background: rgba(47,74,60,0.06); color: var(--ink); }
      .nav-item.active { border-left: 2px solid var(--bottle); background: rgba(47,74,60,0.08); color: var(--ink); font-weight: 500; }

      .sidebar-footer { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 2px; }
      .footer-link { display: flex; align-items: center; gap: 8px; border: none; background: transparent; color: var(--ink-soft); font-family: inherit; font-size: 12px; padding: 6px 10px; cursor: pointer; text-align: left; border-radius: 3px; }
      .footer-link:hover { color: var(--ink); background: rgba(47,74,60,0.06); }

      .main { flex: 1; min-width: 0; padding: 32px 40px 60px; max-width: 940px; }

      .page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; }
      .page-title { font-family: 'Source Serif 4', serif; font-size: 28px; font-weight: 600; margin: 0; }
      .page-subtitle { margin: 4px 0 0; color: var(--ink-soft); font-size: 13.5px; }

      .stat-row { display: flex; gap: 1px; background: var(--line); border: 1px solid var(--line); margin-bottom: 22px; }
      .stat { flex: 1; background: var(--panel); padding: 16px 18px; }
      .stat-value { font-family: 'Source Serif 4', serif; font-size: 24px; font-weight: 600; }
      .stat-label { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }

      .panel { background: var(--panel); border: 1px solid var(--line); padding: 18px 20px 20px; margin-bottom: 20px; }
      .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .panel-title { font-family: 'Source Serif 4', serif; font-size: 16px; font-weight: 600; margin: 0; }

      .tile-grid { display: flex; flex-direction: column; gap: 20px; }
      .event-tile { background: var(--panel); border: 1px solid var(--line); border-top: 3px solid var(--brass); padding: 18px 20px 20px; }
      .tile-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
      .tile-head-actions { display: flex; gap: 4px; }
      .tile-sub { margin: 2px 0 0; color: var(--ink-soft); font-size: 13px; }
      .tile-details { margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
      .details-text { margin: 0; font-size: 13.5px; }
      .muted-text { margin: 0; font-size: 12.5px; color: var(--ink-soft); }
      .link-row { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--bottle); text-decoration: none; width: fit-content; }
      .link-row:hover { text-decoration: underline; }

      .ledger { display: flex; flex-direction: column; }
      .history-change { width: 110px; font-size: 12px; }
      .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
      .chip { border: 1px solid var(--line); background: var(--panel); color: var(--ink-soft); font-family: inherit; font-size: 12.5px; padding: 6px 13px; border-radius: 14px; cursor: pointer; }
      .chip:hover { border-color: var(--bottle); color: var(--ink); }
      .chip.active { background: var(--bottle); border-color: var(--bottle); color: var(--panel); }
      .drill-body { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--line); }
      .drill-stats { display: flex; gap: 26px; margin-bottom: 14px; flex-wrap: wrap; }
      .drill-figure { font-family: 'Source Serif 4', serif; font-size: 18px; font-weight: 600; }
      .page-footnote { font-size: 12.5px; color: var(--ink-soft); margin-top: -6px; }
      .ledger-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); font-size: 13.5px; flex-wrap: nowrap; }
      .ledger-row.wrap { flex-wrap: wrap; row-gap: 8px; }
      .ledger-row:first-child { border-top: none; }

      .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .col-name { flex: 1; min-width: 120px; display: flex; align-items: center; gap: 8px; }
      .freq-tag { font-size: 10.5px; color: var(--ink-soft); border: 1px solid var(--line); padding: 1px 6px; border-radius: 8px; }
      .col-card { color: var(--ink-soft); font-size: 12.5px; width: 110px; }
      .col-date { color: var(--ink-soft); width: 68px; }
      .col-amount { width: 90px; text-align: right; font-weight: 500; }
      .col-balance { width: 100px; text-align: right; font-weight: 600; font-family: 'Source Serif 4', serif; }
      .check-list { display: flex; flex-direction: column; gap: 4px; }
      .check-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13.5px; }
      .check-item input { accent-color: var(--bottle); width: 15px; height: 15px; cursor: pointer; }
      .check-item span:first-of-type { flex: 1; }
      .col-date-input { width: 130px; }
      .col-amount-input { width: 90px; }

      .paid-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
      .paid-toggle input { accent-color: var(--bottle); width: 15px; height: 15px; cursor: pointer; }
      .tag { font-size: 11.5px; padding: 2px 7px; border-radius: 2px; }
      .tag-paid { background: rgba(47,74,60,0.12); color: var(--bottle); }
      .tag-unpaid { background: rgba(163,61,44,0.10); color: var(--rust); }
      .tag-credit { background: rgba(47,74,60,0.12); color: var(--bottle); margin-left: 6px; }
      .tag-debit { background: rgba(184,146,90,0.18); color: var(--brass); margin-left: 6px; }

      .inline-fields { display: flex; gap: 6px; }
      .paid-summary { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-soft); flex-wrap: wrap; max-width: 100%; }
      .input-small { padding: 5px 6px; font-size: 12px; width: auto; max-width: 140px; }
      select.input-small { max-width: 160px; }

      .btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--bottle); background: var(--bottle); color: var(--panel); padding: 8px 14px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; border-radius: 3px; }
      .btn:hover { opacity: 0.92; }
      .btn-ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
      .btn-small { padding: 5px 10px; font-size: 12px; }

      .icon-btn { border: none; background: none; color: var(--ink-soft); cursor: pointer; padding: 4px; display: flex; border-radius: 3px; }
      .icon-btn:hover { color: var(--rust); background: rgba(163,61,44,0.08); }

      .form-panel { border-color: var(--brass); }
      .form-panel-tight { padding: 14px 16px 16px; margin-bottom: 14px; }
      .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px 16px; margin-bottom: 14px; }
      .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
      .field-label { font-size: 12px; color: var(--ink-soft); }
      .input { border: 1px solid var(--line); background: #fff; padding: 8px 10px; font-family: inherit; font-size: 13.5px; border-radius: 3px; color: var(--ink); }
      .input:focus { outline: 2px solid var(--brass); outline-offset: -1px; }
      .textarea { resize: vertical; min-height: 54px; line-height: 1.5; }
      .hint { font-size: 12px; color: var(--ink-soft); margin: -6px 0 14px; }

      .edit-form { border: 1px dashed var(--line); padding: 14px 16px; margin-bottom: 14px; }

      .add-row-form { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }

      .segmented { display: flex; border: 1px solid var(--line); border-radius: 3px; overflow: hidden; width: fit-content; }
      .segment { border: none; background: var(--panel); padding: 6px 12px; font-size: 12px; color: var(--ink-soft); cursor: pointer; font-family: inherit; }
      .segment + .segment { border-left: 1px solid var(--line); }
      .segment.active { background: var(--bottle); color: var(--panel); }

      .forecast-figures { display: flex; gap: 28px; margin-bottom: 14px; }
      .figure-label { font-size: 11.5px; color: var(--ink-soft); }
      .figure-value { font-family: 'Source Serif 4', serif; font-size: 21px; font-weight: 600; }

      .progress-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      .progress-track { flex: 1; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
      .progress-fill { height: 100%; }
      .progress-label { font-size: 12px; color: var(--ink-soft); white-space: nowrap; }

      .empty { color: var(--ink-soft); font-size: 13.5px; padding: 10px 0; }

      .modal-overlay { position: fixed; inset: 0; background: rgba(31,46,35,0.45); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 60; }
      .modal-panel { background: var(--panel); border: 1px solid var(--line); width: 100%; max-width: 440px; padding: 20px 22px 22px; max-height: 88vh; overflow-y: auto; }

      @media (max-width: 760px) {
        .app { flex-direction: column; }
        .sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--line); padding: 14px; }
        nav { flex-direction: row; flex-wrap: wrap; }
        .main { padding: 22px 18px 50px; }
        .stat-row { flex-direction: column; }
        .col-card { display: none; }
      }
    `}</style>
  );
}
