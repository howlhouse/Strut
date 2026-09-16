import { monthKey } from "./format";
import { accountBalance } from "./funding";
import { billDueInfo, billEstimatedAmount } from "./bills";
import { computeForecast } from "./forecast";

export const totalBankBalances = (data) => (data.bankAccounts || []).reduce((s, a) => s + accountBalance(a, data), 0);

export const totalCardBalancesOwed = (data) =>
  data.cards.filter((c) => (c.type || "credit") === "credit").reduce((sum, c) => {
    const series = computeForecast(c, data, 1);
    return sum + (series[0]?.balance || 0);
  }, 0);

// Everything due (bills and layaway installments) within the next
// `horizonDays`, unpaid — the same set the dashboard's "due soon" reminder
// list shows, pulled out here so it can also feed the net-money figure.
export function computeUpcoming(data, horizonDays) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + horizonDays);
  const items = [];
  data.bills.forEach((b) => {
    const { due, key } = billDueInfo(b, today);
    const paid = data.billPayments[key]?.[b.id]?.paid;
    if (!paid && due <= horizon) items.push({ kind: "bill", ref: b, key, due, name: b.name, amount: billEstimatedAmount(b, key), cardId: b.cardId });
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
export function netMoneyNow(data, horizonDays) {
  const upcomingTotal = computeUpcoming(data, horizonDays).reduce((s, i) => s + i.amount, 0);
  return totalBankBalances(data) - totalCardBalancesOwed(data) - upcomingTotal;
}

// Money already charged against a budget's category this real calendar
// month (not the page's navigable month — a budget is always "this month").
export function budgetSpentThisMonth(budget, data) {
  const thisMonth = monthKey(new Date());
  return data.cardTransactions
    .filter((t) => t.categoryId === budget.categoryId && t.type === "charge" && monthKey(new Date(t.date)) === thisMonth)
    .reduce((s, t) => s + Number(t.amount), 0);
}

// Net money after setting aside whatever's left, unspent, in every budget
// this month — money already spent is already reflected in netMoneyNow.
export function netMoneyPostBudget(data, horizonDays) {
  const reserved = (data.budgets || []).reduce((sum, b) => {
    const remaining = Number(b.monthlyAmount) - budgetSpentThisMonth(b, data);
    return sum + Math.max(0, remaining);
  }, 0);
  return netMoneyNow(data, horizonDays) - reserved;
}
