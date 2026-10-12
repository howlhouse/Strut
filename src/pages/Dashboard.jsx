import { useState, useMemo } from "react";
import { Plus, Check, Sparkles } from "lucide-react";
import { money, fmtDate, fmtDateLong, todayISO } from "../utils/format";
import { billDueInfo, billEstimatedAmount } from "../utils/bills";
import { fundingSource } from "../utils/funding";
import { isSameMonth, monthLongLabel, isBillRelevantForMonth } from "../utils/months";
import { totalCardBalancesOwed, netMoneyNow, computeUpcoming } from "../utils/netMoney";
import { isEmptyData } from "../utils/demoData";
import { PageHeader, Panel, Field, Stat, Empty, Modal, MonthSwitcher, FundingSourceSelect, TagChipPicker } from "../components/ui/Primitives";
import { BillRow } from "./BillsPage";

export default function Dashboard({ data, catalog, cardName, cardColor, toggleBillPaid, toggleInstallmentPaid, updateBill, deleteBill, loadDemo, canLoadDemoData, addTransaction, selectedMonth, setSelectedMonth }) {
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
      return paid ? sum : sum + billEstimatedAmount(b, key);
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
            <GlobalTransactionForm data={data} catalog={catalog} addTransaction={addTransaction} onDone={() => setModalOpen(false)} />
          )}
        </Modal>
      )}
    </div>
  );
}

function GlobalTransactionForm({ data, catalog, addTransaction, onDone }) {
  const [cardId, setCardId] = useState(data.cards[0]?.id || (data.bankAccounts || [])[0]?.id || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("charge");
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState([]);
  const source = fundingSource(data, cardId);
  const isDebit = source && (source.type || "credit") === "debit";
  const categories = catalog?.categories || [];
  const tags = catalog?.tags || [];

  const submit = (e) => {
    e.preventDefault();
    if (!cardId || !description || !amount) return;
    addTransaction(cardId, { description, amount: Number(amount), type, date, categoryId: categoryId || null, tagIds });
    onDone();
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Card or account">
          <FundingSourceSelect data={data} value={cardId} onChange={setCardId} />
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
          <Field label="Category (optional)">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">none</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, card payment, paycheck…" /></Field>
      {tags.length > 0 && (
        <Field label="Tags (optional, for budgets)">
          <TagChipPicker tags={tags} value={tagIds} onChange={setTagIds} />
        </Field>
      )}
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add transaction</button>
    </form>
  );
}
