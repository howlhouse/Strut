import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, Trash2, X, Check, LayoutDashboard, Receipt, Ticket, Wallet, Pencil, ExternalLink, Sparkles, Eraser, BarChart3, Landmark, TrendingUp,
  Settings as SettingsIcon, Sun, Moon, Monitor, Bell, PanelLeftClose, PanelLeftOpen, Menu,
  PiggyBank, ShieldCheck, ChevronLeft, ChevronRight, Tags,
} from "lucide-react";
import "./theme.css";
import { getCatalog, setCatalog as saveCatalog, DEFAULT_CATALOG } from "./catalog.js";
import { listUserProfiles, listAdminUids, setAdminAccess } from "./adminData.js";

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

const CARD_COLORS = ["#8B5CF6", "#F472B6", "#22B8A8", "#F5A623"];
const COLOR_BOTTLE = "#8B5CF6";
const COLOR_BRASS = "#F472B6";

// Curated swatches offered when an admin picks a color for a tag or category.
const PALETTE = ["#8B5CF6", "#F472B6", "#22B8A8", "#F5A623", "#E11D5E", "#0E9F6E", "#3E9CFF", "#D9820A", "#6C6480", "#34C77B"];



const DEFAULT_DATA = {
  cards: [], bills: [], billPayments: {}, layaways: [], cardTransactions: [], bankAccounts: [], incomes: [], budgets: [],
  settings: { remindersEnabled: true, reminderDays: 14 },
};

/* ---------------------------------- month helpers ---------------------------------- */

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const monthLongLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Whether a bill belongs on the ledger for a given month. Recurring bills
// always get that month's cycle; a one-time bill belongs to the month it's
// due in, plus (only while looking at the real current month) it stays
// visible for as long as it's unpaid and overdue, so it doesn't silently
// vanish once its due month has passed.
function isBillRelevantForMonth(bill, data, monthDate) {
  if ((bill.frequency || "recurring") !== "onetime") return true;
  const due = new Date(bill.dueDate);
  due.setHours(0, 0, 0, 0);
  if (isSameMonth(due, monthDate)) return true;
  if (!isSameMonth(monthDate, new Date())) return false;
  const payment = data.billPayments[`once-${bill.id}`]?.[bill.id];
  return !payment?.paid && due < new Date(todayISO());
}

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

/* ---------------------------------- net money & budgets ---------------------------------- */

const totalBankBalances = (data) => (data.bankAccounts || []).reduce((s, a) => s + Number(a.balance), 0);

const totalCardBalancesOwed = (data) =>
  data.cards.filter((c) => (c.type || "credit") === "credit").reduce((sum, c) => {
    const series = computeForecast(c, data, 1);
    return sum + (series[0]?.balance || 0);
  }, 0);

// Everything due (bills and layaway installments) within the next
// `horizonDays`, unpaid — the same set the dashboard's "due soon" reminder
// list shows, pulled out here so it can also feed the net-money figure.
function computeUpcoming(data, horizonDays) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + horizonDays);
  const items = [];
  data.bills.forEach((b) => {
    const { due, key } = billDueInfo(b, today);
    const paid = data.billPayments[key]?.[b.id]?.paid;
    if (!paid && due <= horizon) items.push({ kind: "bill", ref: b, key, due, name: b.name, amount: Number(b.amount), cardId: b.cardId });
  });
  data.layaways.forEach((f) => {
    f.installments.forEach((i) => {
      const due = new Date(i.dueDate);
      if (!i.paid && due <= horizon) items.push({ kind: "layaway", fest: f, inst: i, due, name: `${f.festivalName} · ${f.itemName || "installment"}`, amount: Number(i.amount), cardId: f.cardId });
    });
  });
  return items.sort((a, b) => a.due - b.due);
}

// What you'd actually have on hand right now if every bank/card balance
// settled today and every bill or layaway payment due soon went out:
// bank balances, minus what's owed on credit cards, minus upcoming unpaid
// bills/installments within the reminder window.
function netMoneyNow(data, horizonDays) {
  const upcomingTotal = computeUpcoming(data, horizonDays).reduce((s, i) => s + i.amount, 0);
  return totalBankBalances(data) - totalCardBalancesOwed(data) - upcomingTotal;
}

// Money already charged against a budget's category this real calendar
// month (not the page's navigable month — a budget is always "this month").
function budgetSpentThisMonth(budget, data) {
  const thisMonth = monthKey(new Date());
  return data.cardTransactions
    .filter((t) => t.categoryId === budget.categoryId && t.type === "charge" && monthKey(new Date(t.date)) === thisMonth)
    .reduce((s, t) => s + Number(t.amount), 0);
}

// Net money after setting aside whatever's left, unspent, in every budget
// this month — money already spent is already reflected in netMoneyNow.
function netMoneyPostBudget(data, horizonDays) {
  const reserved = (data.budgets || []).reduce((sum, b) => {
    const remaining = Number(b.monthlyAmount) - budgetSpentThisMonth(b, data);
    return sum + Math.max(0, remaining);
  }, 0);
  return netMoneyNow(data, horizonDays) - reserved;
}

/* ---------------------------------- app ---------------------------------- */

export default function App({ storage, canLoadDemoData, isAdmin, isOwner, currentUser, themeMode, setThemeMode }) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("strut-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem("strut-sidebar-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  // On phones/tablets the sidebar becomes an off-canvas drawer instead of a
  // rail — this tracks whether that drawer is open, independent of the
  // desktop full/collapsed-rail preference above.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // The shared tag/category catalog, and which month Dashboard/Bills are
  // currently browsing (defaults to the real current month on every load).
  const [catalog, setCatalogState] = useState(DEFAULT_CATALOG);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));

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
    getCatalog().then((c) => { setCatalogState(c); setCatalogLoaded(true); });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set("finance-data", JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  const update = (fn) => setData((prev) => fn(structuredClone(prev)));

  // Catalog edits (admin only, enforced by firestore.rules) replace the
  // whole shared doc — it's tiny, so this mirrors `update()`'s
  // clone-mutate-persist pattern without needing a merge strategy.
  const updateCatalog = (fn) => {
    setCatalogState((prev) => {
      const next = fn(structuredClone(prev));
      saveCatalog(next).catch(() => {});
      return next;
    });
  };
  const addCategory = (cat) => updateCatalog((c) => { c.categories.push({ id: uid(), ...cat }); return c; });
  const updateCategoryEntry = (id, patch) => updateCatalog((c) => {
    const cat = c.categories.find((x) => x.id === id);
    if (cat) Object.assign(cat, patch);
    return c;
  });
  const deleteCategoryEntry = (id) => updateCatalog((c) => { c.categories = c.categories.filter((x) => x.id !== id); return c; });
  const addTag = (tag) => updateCatalog((c) => { c.tags.push({ id: uid(), ...tag }); return c; });
  const updateTagEntry = (id, patch) => updateCatalog((c) => {
    const t = c.tags.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
    return c;
  });
  const deleteTagEntry = (id) => updateCatalog((c) => { c.tags = c.tags.filter((x) => x.id !== id); return c; });

  /* ---- budget actions ---- */
  const addBudget = (budget) => update((d) => { d.budgets = d.budgets || []; d.budgets.push({ id: uid(), ...budget }); return d; });
  const updateBudget = (id, patch) => update((d) => {
    const b = (d.budgets || []).find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return d;
  });
  const deleteBudget = (id) => update((d) => { d.budgets = (d.budgets || []).filter((b) => b.id !== id); return d; });

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
        d.cardTransactions.push({ id: txId, cardId, date: paidDate, amount: amt, type: "charge", description: bill.name, source: "bill", ref: bill.id, categoryId: bill.categoryId || null });
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

  /* ---- settings actions ---- */
  const updateSettings = (patch) => update((d) => {
    d.settings = { ...(d.settings || DEFAULT_DATA.settings), ...patch };
    return d;
  });

  const loadDemo = () => setData(buildDemoData());
  const clearAll = () => {
    if (window.confirm("Clear all data and start fresh? This can't be undone.")) setData(structuredClone(DEFAULT_DATA));
  };

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "bills", label: "Bills", icon: Receipt },
    { id: "budgets", label: "Budgets", icon: PiggyBank },
    { id: "layaway", label: "Layaway Payments", icon: Ticket },
    { id: "cards", label: "Card ledgers", icon: Wallet },
    { id: "accounts", label: "Bank Accounts", icon: Landmark },
    { id: "forecast", label: "Forecast", icon: TrendingUp },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    ...(isAdmin ? [{ id: "admin", label: "Admin Console", icon: ShieldCheck }] : []),
  ];

  const goTo = (id) => {
    setTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app">
      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} title="Open menu" aria-label="Open menu">
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <span className="brand-mark">S</span>
        <span className="brand-name">Strut</span>
      </div>

      {mobileMenuOpen && <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />}

      <aside className={"sidebar" + (sidebarCollapsed ? " collapsed" : "") + (mobileMenuOpen ? " mobile-open" : "")}>
        <div className="brand">
          <span className="brand-mark">S</span>
          <span className="brand-name">Strut</span>
          <button className="sidebar-close" onClick={() => setMobileMenuOpen(false)} title="Close menu" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={"nav-item" + (tab === n.id ? " active" : "")} onClick={() => goTo(n.id)} title={n.label}>
              <n.icon size={16} strokeWidth={1.75} />
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
            <span className="nav-label">{sidebarCollapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        {tab === "dashboard" && (
          <Dashboard
            data={data}
            catalog={catalog}
            cardName={cardName}
            cardColor={cardColor}
            toggleBillPaid={toggleBillPaid}
            toggleInstallmentPaid={toggleInstallmentPaid}
            updateBill={updateBill}
            deleteBill={deleteBill}
            loadDemo={loadDemo}
            canLoadDemoData={canLoadDemoData}
            addTransaction={addTransaction}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
        )}
        {tab === "bills" && (
          <BillsPage
            data={data}
            catalog={catalog}
            addBill={addBill}
            updateBill={updateBill}
            deleteBill={deleteBill}
            toggleBillPaid={toggleBillPaid}
            cardColor={cardColor}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
        )}
        {tab === "budgets" && (
          <BudgetsPage
            data={data}
            catalog={catalog}
            addBudget={addBudget}
            updateBudget={updateBudget}
            deleteBudget={deleteBudget}
            addCategory={addCategory}
            isAdmin={isAdmin}
          />
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
          <CardsPage data={data} catalog={catalog} addCard={addCard} deleteCard={deleteCard} addTransaction={addTransaction} deleteTransaction={deleteTransaction} cardColor={cardColor} />
        )}
        {tab === "accounts" && (
          <BankAccountsPage data={data} addBankAccount={addBankAccount} updateBankAccount={updateBankAccount} deleteBankAccount={deleteBankAccount} />
        )}
        {tab === "forecast" && (
          <ForecastPage data={data} addIncome={addIncome} deleteIncome={deleteIncome} />
        )}
        {tab === "analytics" && <AnalyticsPage data={data} />}
        {tab === "settings" && (
          <SettingsPage
            settings={data.settings || DEFAULT_DATA.settings}
            updateSettings={updateSettings}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            canLoadDemoData={canLoadDemoData}
            loadDemo={loadDemo}
            clearAll={clearAll}
          />
        )}
        {tab === "admin" && isAdmin && (
          <AdminPage
            catalog={catalog}
            addCategory={addCategory}
            updateCategoryEntry={updateCategoryEntry}
            deleteCategoryEntry={deleteCategoryEntry}
            addTag={addTag}
            updateTagEntry={updateTagEntry}
            deleteTagEntry={deleteTagEntry}
            isOwner={isOwner}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}

/* ---------------------------------- dashboard ---------------------------------- */

function Dashboard({ data, catalog, cardName, cardColor, toggleBillPaid, toggleInstallmentPaid, updateBill, deleteBill, loadDemo, canLoadDemoData, addTransaction, selectedMonth, setSelectedMonth }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const reminderDays = data.settings?.reminderDays ?? 14;
  const remindersEnabled = data.settings?.remindersEnabled !== false;
  const [modalOpen, setModalOpen] = useState(false);
  const empty = isEmptyData(data);
  const viewingCurrentMonth = isSameMonth(selectedMonth, today);

  const upcoming = useMemo(() => computeUpcoming(data, reminderDays), [data, reminderDays]);

  const unpaidTotal = useMemo(() => {
    return data.bills.reduce((sum, b) => {
      const { key } = billDueInfo(b, today);
      const paid = data.billPayments[key]?.[b.id]?.paid;
      return paid ? sum : sum + Number(b.amount);
    }, 0);
  }, [data]);

  const totalOwed = useMemo(() => totalCardBalancesOwed(data), [data]);
  const netMoney = useMemo(() => netMoneyNow(data, reminderDays), [data, reminderDays]);

  const monthBills = useMemo(
    () => data.bills.filter((b) => isBillRelevantForMonth(b, data, selectedMonth)).sort((a, b) => billDueInfo(a, selectedMonth).due - billDueInfo(b, selectedMonth).due),
    [data, selectedMonth]
  );

  const activeLayaways = data.layaways.filter((f) => f.installments.some((i) => !i.paid)).length;

  if (empty) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle={fmtDateLong(today)} />
        <Panel title="Nothing here yet">
          <p className="empty" style={{ marginBottom: canLoadDemoData ? 12 : 0 }}>
            Add your own bills, cards and layaway plans from the tabs on the left
            {canLoadDemoData ? " — or load sample content to see how the dashboard and layaway tiles work." : "."}
          </p>
          {canLoadDemoData && (
            <button className="btn btn-primary" onClick={loadDemo}><Sparkles size={15} /> Load demo data</button>
          )}
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
        <Stat label="Net money" value={money(netMoney)} tone={netMoney >= 0 ? "bottle" : "rust"} />
        <Stat label="Active layaways" value={activeLayaways} tone="brass" />
      </div>
      <p className="page-footnote" style={{ marginBottom: 16 }}>
        Net money is your bank balances minus what's owed on credit cards minus everything due in the next {reminderDays} days — always as of today, regardless of the month you're browsing below.
      </p>

      <MonthSwitcher month={selectedMonth} setMonth={setSelectedMonth} />

      {viewingCurrentMonth ? (
        remindersEnabled ? (
          <Panel title={`Due in the next ${reminderDays} days`}>
            {upcoming.length === 0 ? (
              <Empty text={`Nothing due in the next ${reminderDays} days. Add a bill or a layaway payment to start tracking.`} />
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
        ) : (
          <p className="page-footnote">Dashboard reminders are turned off. Turn them back on in <strong>Settings</strong>.</p>
        )
      ) : (
        <Panel title={`Bills for ${monthLongLabel(selectedMonth)}`}>
          {monthBills.length === 0 ? (
            <Empty text="No bills fall in this month." />
          ) : (
            <div className="ledger">
              {monthBills.map((bill) => (
                <BillRow key={bill.id} bill={bill} data={data} catalog={catalog} referenceDate={selectedMonth} toggleBillPaid={toggleBillPaid} updateBill={updateBill} deleteBill={deleteBill} cardColor={cardColor} />
              ))}
            </div>
          )}
        </Panel>
      )}

      {modalOpen && (
        <Modal title="Add transaction" onClose={() => setModalOpen(false)}>
          {data.cards.length === 0 ? (
            <p className="empty">Add a card first in Card ledgers.</p>
          ) : (
            <GlobalTransactionForm cards={data.cards} catalog={catalog} addTransaction={addTransaction} onDone={() => setModalOpen(false)} />
          )}
        </Modal>
      )}
    </div>
  );
}

function MonthSwitcher({ month, setMonth }) {
  const isCurrent = isSameMonth(month, new Date());
  return (
    <div className="month-switcher">
      <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} title="Previous month"><ChevronLeft size={16} /></button>
      <span className="month-switcher-label">{monthLongLabel(month)}</span>
      <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} title="Next month"><ChevronRight size={16} /></button>
      {!isCurrent && (
        <button className="btn btn-ghost btn-small" onClick={() => setMonth(startOfMonth(new Date()))}>Today</button>
      )}
    </div>
  );
}

/* ---------------------------------- bills page ---------------------------------- */

function BillsPage({ data, catalog, addBill, updateBill, deleteBill, toggleBillPaid, cardColor, selectedMonth, setSelectedMonth }) {
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () =>
      data.bills
        .filter((b) => isBillRelevantForMonth(b, data, selectedMonth))
        .slice()
        .sort((a, b) => billDueInfo(a, selectedMonth).due - billDueInfo(b, selectedMonth).due),
    [data, selectedMonth]
  );

  return (
    <div>
      <PageHeader title="Bills" subtitle="Recurring and one-time bills" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add bill"}
        </button>
      } />

      {adding && <AddBillForm cards={data.cards} catalog={catalog} onAdd={(b) => { addBill(b); setAdding(false); }} />}

      <MonthSwitcher month={selectedMonth} setMonth={setSelectedMonth} />

      <Panel title={`Bills for ${monthLongLabel(selectedMonth)}`}>
        {data.bills.length === 0 ? (
          <Empty text="No bills yet. Add your first bill — recurring or one-time — to start tracking payments." />
        ) : sorted.length === 0 ? (
          <Empty text="No bills fall in this month." />
        ) : (
          <div className="ledger">
            {sorted.map((bill) => (
              <BillRow key={bill.id} bill={bill} data={data} catalog={catalog} referenceDate={selectedMonth} toggleBillPaid={toggleBillPaid} updateBill={updateBill} deleteBill={deleteBill} cardColor={cardColor} />
            ))}
          </div>
        )}
      </Panel>
      <p className="page-footnote">Looking for spending trends and history? Check the <strong>Analytics</strong> tab.</p>
    </div>
  );
}

function BillRow({ bill, data, catalog, referenceDate, toggleBillPaid, updateBill, deleteBill, cardColor }) {
  const { due, key } = billDueInfo(bill, referenceDate);
  const payment = data.billPayments[key]?.[bill.id];
  const paid = !!payment?.paid;
  const overdue = !paid && due < new Date(todayISO());
  const isRecurring = (bill.frequency || "recurring") !== "onetime";
  const [editingPaid, setEditingPaid] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
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
  const category = (catalog?.categories || []).find((c) => c.id === bill.categoryId);
  const tags = (catalog?.tags || []).filter((t) => (bill.tagIds || []).includes(t.id));

  return (
    <div className="ledger-row wrap">
      <span className="dot" style={{ background: bill.cardId ? cardColor(bill.cardId) : "var(--line)" }} />
      <span className="col-name">
        {bill.name}
        <span className="freq-tag">{isRecurring ? "monthly" : "one-time"}</span>
        {category && <Pill item={category} />}
        {tags.map((t) => <Pill key={t.id} item={t} />)}
      </span>
      <span className="col-date" style={{ color: overdue ? "var(--rust)" : "var(--ink-soft)" }}>due {fmtDate(due)}</span>
      <span className="col-amount">{money(bill.amount)}</span>

      <button type="button" className="icon-btn" onClick={() => setEditingTags((v) => !v)} title={editingTags ? "Cancel" : "Edit tags & category"}>
        {editingTags ? <X size={13} /> : <Tags size={13} />}
      </button>

      {!paid && (
        <button type="button" className="icon-btn" onClick={() => { setAmountDraft(bill.amount); setEditingAmount((v) => !v); }} title={editingAmount ? "Cancel" : "Edit amount owed"}>
          {editingAmount ? <X size={13} /> : <Pencil size={13} />}
        </button>
      )}

      <label className="paid-toggle">
        <input type="checkbox" checked={paid} onChange={handleCheck} />
        <span className={paid ? "tag tag-paid" : "tag tag-unpaid"}>{paid ? "Paid" : overdue ? "Overdue" : "Unpaid"}</span>
      </label>

      {editingTags && (
        <CategoryTagEditor
          catalog={catalog}
          categoryId={bill.categoryId}
          tagIds={bill.tagIds || []}
          onSave={(patch) => { updateBill(bill.id, patch); setEditingTags(false); }}
        />
      )}

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

// Small colored pill for a shared catalog tag/category entry.
function Pill({ item }) {
  return <span className="pill" style={{ background: item.color || "var(--ink-soft)" }}>{item.name}</span>;
}

// Inline category (single) + tags (multi) picker, drawing only from the
// shared admin-curated catalog — reused by BillRow.
function CategoryTagEditor({ catalog, categoryId, tagIds, onSave }) {
  const [catId, setCatId] = useState(categoryId || "");
  const [selectedTagIds, setSelectedTagIds] = useState(tagIds);
  const categories = catalog?.categories || [];
  const tags = catalog?.tags || [];

  const toggleTag = (id) => setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="edit-form" style={{ width: "100%" }}>
      <Field label="Category">
        <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">no category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {tags.length > 0 && (
        <Field label="Tags">
          <div className="chip-row">
            {tags.map((t) => (
              <button
                type="button"
                key={t.id}
                className={"chip" + (selectedTagIds.includes(t.id) ? " active" : "")}
                style={selectedTagIds.includes(t.id) ? { background: t.color, borderColor: t.color, color: "#fff" } : {}}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      )}
      {categories.length === 0 && tags.length === 0 && (
        <p className="hint">No tags or categories yet — an admin can add some in the Admin Console.</p>
      )}
      <button type="button" className="btn btn-primary btn-small" onClick={() => onSave({ categoryId: catId || null, tagIds: selectedTagIds })}>
        <Check size={13} /> Save
      </button>
    </div>
  );
}

function AddBillForm({ cards, catalog, onAdd }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("recurring");
  const [dueDay, setDueDay] = useState("1");
  const [dueDate, setDueDate] = useState(todayISO());
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState([]);
  const categories = catalog?.categories || [];
  const tags = catalog?.tags || [];

  const toggleTag = (id) => setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = (e) => {
    e.preventDefault();
    if (!name || !amount) return;
    const bill = { name, amount: Number(amount), cardId, frequency, categoryId: categoryId || null, tagIds };
    if (frequency === "recurring") bill.dueDay = Number(dueDay);
    else bill.dueDate = dueDate;
    onAdd(bill);
    setName(""); setAmount(""); setDueDay("1"); setDueDate(todayISO()); setCategoryId(""); setTagIds([]);
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
        <Field label="Category">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">no category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      {tags.length > 0 && (
        <Field label="Tags">
          <div className="chip-row">
            {tags.map((t) => (
              <button
                type="button"
                key={t.id}
                className={"chip" + (tagIds.includes(t.id) ? " active" : "")}
                style={tagIds.includes(t.id) ? { background: t.color, borderColor: t.color, color: "#fff" } : {}}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      )}
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add bill</button>
    </form>
  );
}

/* ---------------------------------- layaway page ---------------------------------- */

function LayawayPage({ data, addFestival, deleteFestival, updateFestivalMeta, toggleInstallmentPaid, addInstallment, deleteInstallment, updateInstallment, cardColor }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader title="Layaway Payments" subtitle="Installment plans for festivals, flex pay, and other financed items" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add plan"}
        </button>
      } />

      {adding && <AddFestivalForm cards={data.cards} onAdd={(f) => { addFestival(f); setAdding(false); }} />}

      {data.layaways.length === 0 ? (
        <Panel title="Plans"><Empty text="No layaway plans yet. Add a festival, flex-pay purchase, or other financed item to build a payment schedule." /></Panel>
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
              <ExternalLink size={13} /> Tracking link
            </a>
          )}
          {fest.notes && <p className="muted-text">{fest.notes}</p>}
          <p className="muted-text">Card: {fest.cardId ? cards.find((c) => c.id === fest.cardId)?.name || "—" : "none set"}</p>
        </div>
      )}

      <div className="progress-row">
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, backgroundImage: "var(--rainbow)" }} /></div>
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
        <Field label="Item or plan name"><input className="input" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} /></Field>
        <Field label="Item"><input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} /></Field>
        <Field label="Tracking link"><input className="input" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="Card">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">no card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Details"><textarea className="input textarea" value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Dates, vendor, plan details…" /></Field>
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
        <Field label="Item or plan name"><input className="input" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} placeholder="e.g. Okeechobee, Affirm — sofa, Klarna order" /></Field>
        <Field label="Item (optional)"><input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="GA ticket, camping, sectional couch…" /></Field>
        <Field label="Tracking link (optional)"><input className="input" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="Card">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">no card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Details (optional)"><textarea className="input textarea" value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Dates, vendor, plan details…" /></Field>
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

function GlobalTransactionForm({ cards, catalog, addTransaction, onDone }) {
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("charge");
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const card = cards.find((c) => c.id === cardId);
  const isDebit = card && (card.type || "credit") === "debit";
  const categories = catalog?.categories || [];

  const submit = (e) => {
    e.preventDefault();
    if (!cardId || !description || !amount) return;
    addTransaction(cardId, { description, amount: Number(amount), type, date, categoryId: categoryId || null });
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
        {categories.length > 0 && (
          <Field label="Budget category (optional)">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">none</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, card payment, paycheck…" /></Field>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add transaction</button>
    </form>
  );
}

/* ---------------------------------- cards page ---------------------------------- */

function CardsPage({ data, catalog, addCard, deleteCard, addTransaction, deleteTransaction, cardColor }) {
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
          <CardLedgerPanel key={c.id} card={c} data={data} catalog={catalog} addTransaction={addTransaction} deleteTransaction={deleteTransaction} deleteCard={deleteCard} color={cardColor(c.id)} />
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

function CardLedgerPanel({ card, data, catalog, addTransaction, deleteTransaction, deleteCard, color }) {
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

      {showForm && <TransactionForm card={card} catalog={catalog} onAdd={(tx) => { addTransaction(card.id, tx); setShowForm(false); }} />}

      {txs.length === 0 ? (
        <Empty text="No transactions yet. Paid bills and layaway installments assigned to this card will show up here automatically." />
      ) : (
        <div className="ledger">
          {txs.map((t) => (
            <div className="ledger-row" key={t.id}>
              <span className="dot" style={{ background: t.type === "charge" ? "var(--rust)" : "var(--bottle)" }} />
              <span className="col-name">
                {t.description}
                {t.categoryId && (catalog?.categories || []).find((c) => c.id === t.categoryId) && (
                  <Pill item={(catalog.categories || []).find((c) => c.id === t.categoryId)} />
                )}
              </span>
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

function TransactionForm({ card, catalog, onAdd }) {
  const isDebit = (card.type || "credit") === "debit";
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("charge");
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const categories = catalog?.categories || [];

  const submit = (e) => {
    e.preventDefault();
    if (!description || !amount) return;
    onAdd({ description, amount: Number(amount), type, date, categoryId: categoryId || null });
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
        {categories.length > 0 && (
          <Field label="Budget category (optional)">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">none</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
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
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
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

/* ---------------------------------- budgets page ---------------------------------- */

function BudgetsPage({ data, catalog, addBudget, updateBudget, deleteBudget, addCategory, isAdmin }) {
  const [adding, setAdding] = useState(false);
  const budgets = data.budgets || [];
  const reminderDays = data.settings?.reminderDays ?? 14;
  const postBudget = useMemo(() => netMoneyPostBudget(data, reminderDays), [data, reminderDays]);
  const totalMonthly = budgets.reduce((s, b) => s + Number(b.monthlyAmount), 0);
  const totalSpent = budgets.reduce((s, b) => s + budgetSpentThisMonth(b, data), 0);

  const availableCategories = (catalog?.categories || []).filter((c) => !budgets.some((b) => b.categoryId === c.id));

  return (
    <div>
      <PageHeader title="Budgets" subtitle="Monthly spending targets by category" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add budget"}
        </button>
      } />

      <div className="stat-row">
        <Stat label="Total budgeted this month" value={money(totalMonthly)} tone="ink" />
        <Stat label="Spent so far this month" value={money(totalSpent)} tone={totalSpent > totalMonthly ? "rust" : "brass"} />
        <Stat label="Net money post-budget" value={money(postBudget)} tone={postBudget >= 0 ? "bottle" : "rust"} />
      </div>
      <p className="page-footnote" style={{ marginBottom: 16 }}>
        Net money post-budget takes today's net money and sets aside whatever's left, unspent, in every budget below — money already spent is already reflected in net money.
      </p>

      {adding && (
        <AddBudgetForm
          availableCategories={availableCategories}
          isAdmin={isAdmin}
          onAdd={(b) => { addBudget(b); setAdding(false); }}
          onAddCategory={addCategory}
        />
      )}

      <Panel title="Budgets">
        {budgets.length === 0 ? (
          <Empty text="No budgets yet. Add a category — like Gas or Groceries — and a monthly amount to start tracking it." />
        ) : (
          <div className="ledger">
            {budgets.map((b) => (
              <BudgetRow key={b.id} budget={b} data={data} catalog={catalog} updateBudget={updateBudget} deleteBudget={deleteBudget} />
            ))}
          </div>
        )}
      </Panel>
      <p className="page-footnote">
        Transactions on the <strong>Card ledgers</strong> and <strong>Dashboard</strong> pages count against a budget when you pick that budget's category on them.
      </p>
    </div>
  );
}

function BudgetRow({ budget, data, catalog, updateBudget, deleteBudget }) {
  const category = (catalog?.categories || []).find((c) => c.id === budget.categoryId);
  const spent = budgetSpentThisMonth(budget, data);
  const monthly = Number(budget.monthlyAmount);
  const remaining = monthly - spent;
  const pct = monthly ? Math.min(100, Math.round((spent / monthly) * 100)) : 0;
  const [editing, setEditing] = useState(false);
  const [amountDraft, setAmountDraft] = useState(budget.monthlyAmount);

  const save = () => {
    updateBudget(budget.id, { monthlyAmount: Number(amountDraft) || 0 });
    setEditing(false);
  };

  return (
    <div className="ledger-row wrap" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="ledger-row" style={{ borderTop: "none", padding: "0 0 6px" }}>
        <span className="dot" style={{ background: category?.color || "var(--line)" }} />
        <span className="col-name">{category ? <Pill item={category} /> : "unknown category"}</span>
        <span className="col-date" style={{ color: remaining < 0 ? "var(--rust)" : "var(--ink-soft)" }}>{money(spent)} spent</span>
        {editing ? (
          <div className="paid-summary">
            <input type="number" step="0.01" className="input input-small col-amount-input" value={amountDraft} autoFocus onChange={(e) => setAmountDraft(e.target.value)} />
            <button type="button" className="icon-btn" onClick={save} title="Save"><Check size={14} /></button>
          </div>
        ) : (
          <>
            <span className="col-amount">{money(monthly)}/mo</span>
            <button type="button" className="icon-btn" onClick={() => { setAmountDraft(budget.monthlyAmount); setEditing(true); }} title="Edit monthly amount"><Pencil size={13} /></button>
          </>
        )}
        <button className="icon-btn" onClick={() => deleteBudget(budget.id)} title="Remove budget"><Trash2 size={14} /></button>
      </div>
      <div className="progress-row" style={{ marginBottom: 4 }}>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: remaining < 0 ? "var(--rust)" : (category?.color || "var(--brand)") }} /></div>
        <span className="progress-label">{remaining >= 0 ? `${money(remaining)} left` : `${money(-remaining)} over`}</span>
      </div>
    </div>
  );
}

function AddBudgetForm({ availableCategories, isAdmin, onAdd, onAddCategory }) {
  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id || "");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PALETTE[0]);

  const submit = (e) => {
    e.preventDefault();
    if (!categoryId || !monthlyAmount) return;
    onAdd({ categoryId, monthlyAmount: Number(monthlyAmount) });
    setMonthlyAmount("");
  };

  const createCategory = () => {
    if (!newCatName) return;
    onAddCategory({ name: newCatName, color: newCatColor });
    setNewCatName("");
    setCreatingCategory(false);
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Category">
          {availableCategories.length > 0 ? (
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              {isAdmin ? "No unbudgeted categories left — add a new one below." : "No categories available yet — ask an admin to add one in the Admin Console."}
            </p>
          )}
        </Field>
        <Field label="Monthly amount"><input className="input" type="number" step="0.01" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} placeholder="0.00" /></Field>
      </div>
      {availableCategories.length > 0 && (
        <button className="btn btn-primary" type="submit"><Plus size={15} /> Add budget</button>
      )}

      {isAdmin && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
          {creatingCategory ? (
            <div className="add-row-form" style={{ flexWrap: "wrap" }}>
              <input className="input input-small" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="New category name" />
              <ColorSwatchPicker value={newCatColor} onChange={setNewCatColor} />
              <button type="button" className="btn btn-primary btn-small" onClick={createCategory}><Plus size={13} /> Create</button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setCreatingCategory(false)}><X size={13} /></button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setCreatingCategory(true)}><Plus size={13} /> New category</button>
          )}
        </div>
      )}
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
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
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

// A row of curated color swatches plus a raw color input, used wherever an
// admin picks a tag/category color.
function ColorSwatchPicker({ value, onChange }) {
  return (
    <div className="swatch-row">
      {PALETTE.map((c) => (
        <button
          type="button"
          key={c}
          className={"swatch" + (value === c ? " active" : "")}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
      <input type="color" className="swatch-custom" value={value} onChange={(e) => onChange(e.target.value)} title="Custom color" />
    </div>
  );
}

/* ---------------------------------- settings page ---------------------------------- */

function SettingsPage({ settings, updateSettings, themeMode, setThemeMode, canLoadDemoData, loadDemo, clearAll }) {
  const [reminderDaysDraft, setReminderDaysDraft] = useState(settings.reminderDays);

  const saveReminderDays = () => {
    const v = Math.min(60, Math.max(1, Number(reminderDaysDraft) || 14));
    setReminderDaysDraft(v);
    updateSettings({ reminderDays: v });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Appearance, reminders and data" />

      <Panel title="Appearance">
        <div className="setting-row">
          <div>
            <div className="setting-row-label">Theme</div>
            <div className="setting-row-desc">Choose light, dark, or match your device's setting.</div>
          </div>
          <div className="segmented">
            <button className={"segment" + (themeMode === "light" ? " active" : "")} onClick={() => setThemeMode("light")}><Sun size={13} /> Light</button>
            <button className={"segment" + (themeMode === "dark" ? " active" : "")} onClick={() => setThemeMode("dark")}><Moon size={13} /> Dark</button>
            <button className={"segment" + (themeMode === "system" ? " active" : "")} onClick={() => setThemeMode("system")}><Monitor size={13} /> System</button>
          </div>
        </div>
      </Panel>

      <Panel title="Reminders">
        <div className="setting-row">
          <div>
            <div className="setting-row-label">Dashboard due-soon reminders</div>
            <div className="setting-row-desc">Show a list of upcoming bills and layaway payments on the dashboard.</div>
          </div>
          <div className="setting-row-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.remindersEnabled !== false}
                onChange={(e) => updateSettings({ remindersEnabled: e.target.checked })}
              />
              <span className="switch-track" />
            </label>
          </div>
        </div>
        {settings.remindersEnabled !== false && (
          <div className="setting-row">
            <div>
              <div className="setting-row-label">Remind me this many days ahead</div>
              <div className="setting-row-desc">How far out counts as "due soon" on the dashboard.</div>
            </div>
            <div className="setting-row-control">
              <input
                className="input input-small col-amount-input"
                type="number"
                min="1"
                max="60"
                value={reminderDaysDraft}
                onChange={(e) => setReminderDaysDraft(e.target.value)}
                onBlur={saveReminderDays}
              />
              <span className="muted-text">days</span>
            </div>
          </div>
        )}
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          <Bell size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
          These are in-app reminders shown on the dashboard, not push or email notifications.
        </p>
      </Panel>

      <Panel title="Data">
        <div className="setting-row" style={{ flexWrap: "wrap" }}>
          <div>
            <div className="setting-row-label">Sample content</div>
            <div className="setting-row-desc">Load example bills, cards and layaway plans to explore the app.</div>
          </div>
          {canLoadDemoData ? (
            <button className="btn btn-ghost btn-small" onClick={loadDemo}><Sparkles size={13} /> Load demo data</button>
          ) : (
            <span className="muted-text">Not available on this account.</span>
          )}
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-row-label">Reset everything</div>
            <div className="setting-row-desc">Permanently clear all bills, cards, layaways and accounts.</div>
          </div>
          <button className="btn btn-ghost btn-small" onClick={clearAll}><Eraser size={13} /> Clear all data</button>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------- admin console ---------------------------------- */

function AdminPage({ catalog, addCategory, updateCategoryEntry, deleteCategoryEntry, addTag, updateTagEntry, deleteTagEntry, isOwner, currentUser }) {
  const [section, setSection] = useState("users"); // 'users' | 'catalog'

  return (
    <div>
      <PageHeader title="Admin Console" subtitle="Account access and the shared tag/category catalog" />
      <div className="segmented" style={{ marginBottom: 18 }}>
        <button className={"segment" + (section === "users" ? " active" : "")} onClick={() => setSection("users")}>Users</button>
        <button className={"segment" + (section === "catalog" ? " active" : "")} onClick={() => setSection("catalog")}>Tags & Categories</button>
      </div>

      {section === "users" ? (
        <AdminUsersSection isOwner={isOwner} currentUser={currentUser} />
      ) : (
        <AdminCatalogSection
          catalog={catalog}
          addCategory={addCategory}
          updateCategoryEntry={updateCategoryEntry}
          deleteCategoryEntry={deleteCategoryEntry}
          addTag={addTag}
          updateTagEntry={updateTagEntry}
          deleteTagEntry={deleteTagEntry}
        />
      )}
    </div>
  );
}

function AdminUsersSection({ isOwner, currentUser }) {
  const [profiles, setProfiles] = useState(null); // null = loading
  const [adminUids, setAdminUids] = useState([]);
  const [error, setError] = useState("");

  const reload = () => {
    Promise.all([listUserProfiles(), listAdminUids()])
      .then(([p, a]) => { setProfiles(p); setAdminUids(a); })
      .catch(() => setError("Couldn't load users."));
  };

  useEffect(reload, []);

  const toggleAdmin = (profile) => {
    const next = !adminUids.includes(profile.uid);
    setAdminUids((prev) => (next ? [...prev, profile.uid] : prev.filter((id) => id !== profile.uid)));
    setAdminAccess(profile.uid, next, profile.email).catch(() => { setError("Couldn't update admin access."); reload(); });
  };

  const fmtTimestamp = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(d) ? "—" : fmtDateLong(d);
  };

  return (
    <Panel title="Users">
      {error && <p className="hint" style={{ color: "var(--rust)" }}>{error}</p>}
      {profiles === null ? (
        <p className="empty">Loading…</p>
      ) : profiles.length === 0 ? (
        <Empty text="No user accounts found yet." />
      ) : (
        <div className="ledger">
          {profiles.map((p) => {
            const isThisOwner = p.email === "howlhousemedia@gmail.com";
            const isAdminUser = isThisOwner || adminUids.includes(p.uid);
            return (
              <div className="ledger-row wrap" key={p.uid}>
                <span className="dot" style={{ background: isAdminUser ? "var(--brand)" : "var(--line)" }} />
                <span className="col-name">
                  {p.displayName || p.email}
                  {isThisOwner && <span className="tag tag-credit">Owner</span>}
                  {p.uid === currentUser?.uid && <span className="tag tag-debit">You</span>}
                </span>
                <span className="col-card" style={{ width: 200 }}>{p.email}</span>
                <span className="col-date" style={{ width: 110 }}>joined {fmtTimestamp(p.createdAt)}</span>
                <span className="col-date" style={{ width: 110 }}>active {fmtTimestamp(p.lastLoginAt)}</span>
                <label className="paid-toggle" title={isOwner ? "Grant or revoke admin access" : "Only the account owner can change admin access"}>
                  <input type="checkbox" checked={isAdminUser} disabled={!isOwner || isThisOwner} onChange={() => toggleAdmin(p)} />
                  <span className={isAdminUser ? "tag tag-paid" : "tag tag-unpaid"}>{isAdminUser ? "Admin" : "No admin access"}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
      {!isOwner && <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>Only the account owner can grant or revoke admin access.</p>}
    </Panel>
  );
}

function AdminCatalogSection({ catalog, addCategory, updateCategoryEntry, deleteCategoryEntry, addTag, updateTagEntry, deleteTagEntry }) {
  return (
    <>
      <CatalogEditor title="Categories" items={catalog.categories} onAdd={addCategory} onUpdate={updateCategoryEntry} onDelete={deleteCategoryEntry} addLabel="Add category" />
      <CatalogEditor title="Tags" items={catalog.tags} onAdd={addTag} onUpdate={updateTagEntry} onDelete={deleteTagEntry} addLabel="Add tag" />
    </>
  );
}

function CatalogEditor({ title, items, onAdd, onUpdate, onDelete, addLabel }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const submitAdd = (e) => {
    e.preventDefault();
    if (!newName) return;
    onAdd({ name: newName, color: newColor });
    setNewName(""); setNewColor(PALETTE[0]); setAdding(false);
  };

  return (
    <Panel title={title} right={
      <button className="btn btn-ghost btn-small" onClick={() => setAdding((v) => !v)}>
        {adding ? <X size={13} /> : <Plus size={13} />} {adding ? "Close" : addLabel}
      </button>
    }>
      {adding && (
        <form className="add-row-form" style={{ flexWrap: "wrap" }} onSubmit={submitAdd}>
          <input className="input input-small" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" autoFocus />
          <ColorSwatchPicker value={newColor} onChange={setNewColor} />
          <button className="btn btn-primary btn-small" type="submit"><Plus size={13} /> Add</button>
        </form>
      )}
      {items.length === 0 ? (
        <Empty text={`No ${title.toLowerCase()} yet.`} />
      ) : (
        <div className="ledger">
          {items.map((item) => (
            <CatalogItemRow key={item.id} item={item} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function CatalogItemRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [colorDraft, setColorDraft] = useState(item.color);

  const save = () => {
    onUpdate(item.id, { name: nameDraft, color: colorDraft });
    setEditing(false);
  };

  return (
    <div className="ledger-row wrap">
      <span className="dot" style={{ background: item.color }} />
      {editing ? (
        <div className="paid-summary" style={{ flex: 1 }}>
          <input className="input input-small" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          <ColorSwatchPicker value={colorDraft} onChange={setColorDraft} />
          <button type="button" className="icon-btn" onClick={save} title="Save"><Check size={14} /></button>
          <button type="button" className="icon-btn" onClick={() => setEditing(false)} title="Cancel"><X size={14} /></button>
        </div>
      ) : (
        <>
          <span className="col-name"><Pill item={item} /></span>
          <button type="button" className="icon-btn" onClick={() => { setNameDraft(item.name); setColorDraft(item.color); setEditing(true); }} title="Edit"><Pencil size={13} /></button>
        </>
      )}
      <button className="icon-btn" onClick={() => onDelete(item.id)} title="Delete"><Trash2 size={14} /></button>
    </div>
  );
}
