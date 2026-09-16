import { iso, addDays, monthKey } from "./format";

export const isEmptyData = (d) => d.cards.length === 0 && d.bills.length === 0 && d.layaways.length === 0;

export function buildDemoData() {
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

  // "Car Payment" is pinned straight to the bank account (not a card) — the
  // account's own ledger, not a card's, is what should move when it's paid.
  const checkingAcctId = "demo-acct-checking";
  const carDueDay = Math.min(Math.max(today.getDate() - 10, 1), 27);
  const carLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, carDueDay);

  const bills = [
    { id: "demo-bill-rent", name: "Rent", amount: 1450, cardId: debitId, frequency: "recurring", dueDay: 1 },
    { id: "demo-bill-car", name: "Car Payment", amount: 385, cardId: checkingAcctId, frequency: "recurring", dueDay: carDueDay },
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
    [monthKey(carLastMonth)]: {
      "demo-bill-car": { paid: true, paidDate: iso(carLastMonth), cardId: checkingAcctId, amount: 385, txId: "demo-tx-car-1" },
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
    { id: checkingAcctId, name: "Main Checking", type: "checking", balance: 1450.32, updatedDate: iso(addDays(today, -1)) },
    { id: "demo-acct-savings", name: "Emergency Savings", type: "savings", balance: 4200.0, updatedDate: iso(addDays(today, -6)) },
  ];

  const accountTransactions = [
    { id: "demo-tx-car-1", accountId: checkingAcctId, date: iso(carLastMonth), amount: 385, type: "charge", description: "Car Payment", source: "bill", ref: "demo-bill-car" },
    { id: "demo-tx-coffee", accountId: checkingAcctId, date: iso(addDays(today, -2)), amount: 6.5, type: "charge", description: "Coffee", source: "manual" },
  ];

  return { cards, bills, billPayments, layaways, cardTransactions, bankAccounts, accountTransactions };
}
