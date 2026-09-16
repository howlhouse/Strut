import { todayISO } from "./format";

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
export const monthLongLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Whether a bill belongs on the ledger for a given month. Recurring bills
// always get that month's cycle; a one-time bill belongs to the month it's
// due in, plus (only while looking at the real current month) it stays
// visible for as long as it's unpaid and overdue, so it doesn't silently
// vanish once its due month has passed.
export function isBillRelevantForMonth(bill, data, monthDate) {
  if ((bill.frequency || "recurring") !== "onetime") return true;
  const due = new Date(bill.dueDate);
  due.setHours(0, 0, 0, 0);
  if (isSameMonth(due, monthDate)) return true;
  if (!isSameMonth(monthDate, new Date())) return false;
  const payment = data.billPayments[`once-${bill.id}`]?.[bill.id];
  return !payment?.paid && due < new Date(todayISO());
}
