import { fmtDate, monthKey, daysInMonth } from "./format";
import { signedAmount, accountBalance } from "./funding";
import { billEstimatedAmount } from "./bills";

export function computeForecast(card, data, horizonDays) {
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
        events.push({ date: due, delta: signedAmount(card, "charge", billEstimatedAmount(b, mk)) });
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
export function incomeOccurrences(income, today, horizonEnd) {
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
export function computeCashForecast(data, accountIds, horizonDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const accounts = (data.bankAccounts || []).filter((a) => accountIds.includes(a.id));
  const startingBalance = accounts.reduce((s, a) => s + accountBalance(a, data), 0);

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
      const mk = monthKey(due);
      const payment = data.billPayments[mk]?.[b.id];
      if (due >= today && due <= horizonEnd && !payment?.paid) events.push({ date: due, amount: -billEstimatedAmount(b, mk), label: b.name, kind: "bill" });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  });

  data.layaways.forEach((f) => {
    f.installments.forEach((inst) => {
      const due = new Date(inst.dueDate);
      if (!inst.paid && due >= today && due <= horizonEnd) events.push({ date: due, amount: -Number(inst.amount), label: `${f.festivalName} payment`, kind: "layaway" });
    });
  });

  // Manually logged transactions against a tracked account (e.g. a future-
  // dated deposit or charge someone entered ahead of time) count too, the
  // same way a future-dated card transaction already shows up in a card's
  // own forecast.
  (data.accountTransactions || []).filter((t) => accountIds.includes(t.accountId)).forEach((t) => {
    const td = new Date(t.date);
    td.setHours(0, 0, 0, 0);
    if (td > today && td <= horizonEnd) {
      events.push({ date: td, amount: (t.type === "charge" ? -1 : 1) * Number(t.amount), label: t.description, kind: "transaction" });
    }
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
