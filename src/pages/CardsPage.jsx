import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { money, fmtDate, todayISO } from "../utils/format";
import { computeForecast } from "../utils/forecast";
import { balanceTone } from "../utils/funding";
import { PageHeader, Panel, Field, Empty, Pill } from "../components/ui/Primitives";

export default function CardsPage({ data, catalog, addCard, deleteCard, addTransaction, deleteTransaction, cardColor }) {
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
