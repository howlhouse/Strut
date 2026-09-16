import { monthKey, daysInMonth } from "./format";

// Always resolves to the CURRENT cycle's due date/key for a recurring bill,
// even if that date has already passed and it's still unpaid (so overdue
// bills stay visible instead of silently rolling to next month).
export function billDueInfo(bill, from = new Date()) {
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
export function billHistoryEntries(bill, data) {
  return Object.keys(data.billPayments)
    .filter((key) => !key.startsWith("once-"))
    .map((key) => ({ key, ...(data.billPayments[key]?.[bill.id] || {}) }))
    .filter((e) => e.paid && e.amount != null)
    .sort((a, b) => a.key.localeCompare(b.key));
}

// A user-preloaded amount for one specific cycle of a recurring bill — e.g. a
// billing schedule the provider already handed you (Geico's month-by-month
// installments for a usage/rate-dependent bill). Consulted only until that
// cycle is actually paid; toggleBillPaid clears the entry once it's fulfilled.
export function scheduledAmountFor(bill, key) {
  const v = bill.scheduledAmounts?.[key];
  return v != null && v !== "" ? Number(v) : undefined;
}

// The best estimate for a bill's given (not-yet-paid) cycle: a preloaded
// schedule entry for that exact month if one was set, else the bill's
// running default (normally the amount actually paid last cycle).
export function billEstimatedAmount(bill, key) {
  return scheduledAmountFor(bill, key) ?? Number(bill.amount);
}

// Every preloaded future/current cycle that hasn't been paid yet, soonest
// first — the flip side of billHistoryEntries.
export function billScheduleEntries(bill) {
  return Object.entries(bill.scheduledAmounts || {})
    .map(([key, amount]) => ({ key, amount: Number(amount) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
