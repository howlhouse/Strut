import { todayISO } from "./format";

// A "charge" always increases what a credit card owes, but decreases what's
// left in a debit/checking account. A "payment" (paying down a card, or
// depositing to checking) does the opposite. This resolves the direction.
export function signedAmount(card, type, amount) {
  const typeSign = type === "charge" ? 1 : -1;
  const cardSign = (card.type || "credit") === "debit" ? -1 : 1;
  return typeSign * cardSign * Number(amount);
}

export function balanceTone(card, balance) {
  if ((card.type || "credit") === "debit") return balance < 0 ? "var(--rust)" : "var(--bottle)";
  return balance > 0 ? "var(--rust)" : "var(--bottle)";
}

export function cardOptionLabel(c) {
  return `${c.name} · ${(c.type || "credit") === "debit" ? "Debit" : "Credit"}`;
}

export function accountOptionLabel(a) {
  return `${a.name} · ${a.type === "savings" ? "Savings" : "Checking"}`;
}

// A bill, layaway, or manual transaction can be funded either from a card
// (data.cards, its own credit/debit ledger) or a plain bank account
// (data.bankAccounts) — e.g. a car payment that can only ever be paid from
// one specific checking account. IDs are unique across both collections
// (both use uid()), so a single stored id resolves unambiguously to
// whichever one it belongs to. Bank accounts are normalized to look like a
// debit card here (type: "debit", no credit limit) so the existing
// sign/color/balance helpers built for cards work on both without a
// separate code path.
export function fundingSource(data, id) {
  if (!id) return null;
  const card = data.cards.find((c) => c.id === id);
  if (card) return { ...card, kind: "card" };
  const acct = (data.bankAccounts || []).find((a) => a.id === id);
  if (acct) return { ...acct, kind: "account", type: "debit", creditLimit: null };
  return null;
}

export const isBankAccountId = (d, id) => !d.cards.some((c) => c.id === id) && (d.bankAccounts || []).some((a) => a.id === id);

// A bank account's balance is derived the same way a card's is: a manually
// reconciled anchor (balance/updatedDate) plus every transaction logged
// against it since that date — so logging a bill or transaction against an
// account keeps its balance current without hand-editing it every time.
export function accountBalance(account, data) {
  const asOf = account.updatedDate ? new Date(account.updatedDate) : new Date(todayISO());
  const today = new Date(todayISO());
  let balance = Number(account.balance) || 0;
  (data.accountTransactions || []).filter((t) => t.accountId === account.id).forEach((t) => {
    const td = new Date(t.date);
    if (td > asOf && td <= today) balance += (t.type === "charge" ? -1 : 1) * Number(t.amount);
  });
  return Math.round(balance * 100) / 100;
}
