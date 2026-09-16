import { useState } from "react";
import { Plus, X, Check, Pencil, Trash2 } from "lucide-react";
import { money, fmtDate, todayISO } from "../utils/format";
import { accountBalance } from "../utils/funding";
import { PageHeader, Panel, Field, Stat, Empty, Pill } from "../components/ui/Primitives";

export default function BankAccountsPage({ data, catalog, addBankAccount, updateBankAccount, deleteBankAccount, addTransaction, updateTransaction, deleteTransaction }) {
  const [adding, setAdding] = useState(false);
  const accounts = data.bankAccounts || [];
  const totalChecking = accounts.filter((a) => a.type !== "savings").reduce((s, a) => s + accountBalance(a, data), 0);
  const totalSavings = accounts.filter((a) => a.type === "savings").reduce((s, a) => s + accountBalance(a, data), 0);

  return (
    <div>
      <PageHeader title="Bank Accounts" subtitle="Checking and savings, with a running transaction ledger" action={
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

      {accounts.length === 0 ? (
        <Panel title="Accounts"><Empty text="No accounts yet. Add a checking or savings account to start tracking its balance and logging bills or transactions directly against it." /></Panel>
      ) : (
        accounts.map((a) => (
          <AccountLedgerPanel
            key={a.id}
            account={a}
            data={data}
            catalog={catalog}
            updateBankAccount={updateBankAccount}
            deleteBankAccount={deleteBankAccount}
            addTransaction={addTransaction}
            updateTransaction={updateTransaction}
            deleteTransaction={deleteTransaction}
          />
        ))
      )}
    </div>
  );
}

function AccountLedgerPanel({ account, data, catalog, updateBankAccount, deleteBankAccount, addTransaction, updateTransaction, deleteTransaction }) {
  const [showForm, setShowForm] = useState(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState(account.balance);
  const [dateDraft, setDateDraft] = useState(account.updatedDate || todayISO());
  const isSavings = account.type === "savings";
  const balance = accountBalance(account, data);
  const txs = (data.accountTransactions || []).filter((t) => t.accountId === account.id).sort((a, b) => new Date(b.date) - new Date(a.date));

  const saveBalance = () => {
    updateBankAccount(account.id, { balance: Number(balanceDraft) || 0, updatedDate: dateDraft });
    setEditingBalance(false);
  };

  return (
    <Panel
      title={
        <span>
          {account.name} <span className={"tag " + (isSavings ? "tag-debit" : "tag-credit")}>{isSavings ? "Savings" : "Checking"}</span>
        </span>
      }
      right={<button className="icon-btn" onClick={() => deleteBankAccount(account.id)} title="Delete account"><Trash2 size={14} /></button>}
    >
      <div className="forecast-figures">
        <div>
          <div className="figure-label">Balance</div>
          <div className="figure-value" style={{ color: balance < 0 ? "var(--rust)" : "var(--bottle)" }}>{money(balance)}</div>
        </div>
      </div>

      {!editingBalance ? (
        <button
          type="button"
          className="btn btn-ghost btn-small"
          style={{ marginBottom: 12, marginRight: 8 }}
          onClick={() => { setBalanceDraft(account.balance); setDateDraft(account.updatedDate || todayISO()); setEditingBalance(true); }}
        >
          <Pencil size={13} /> Reconcile balance
        </button>
      ) : (
        <div className="paid-summary" style={{ marginBottom: 12 }}>
          <span>Balance was</span>
          <input type="number" step="0.01" className="input input-small col-amount-input" value={balanceDraft} autoFocus onChange={(e) => setBalanceDraft(e.target.value)} />
          <span>as of</span>
          <input type="date" className="input input-small" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
          <button type="button" className="icon-btn" onClick={saveBalance} title="Save"><Check size={14} /></button>
          <button type="button" className="icon-btn" onClick={() => setEditingBalance(false)} title="Cancel"><X size={14} /></button>
        </div>
      )}

      <button className="btn btn-ghost btn-small" style={{ marginBottom: 12 }} onClick={() => setShowForm((v) => !v)}>
        {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Close" : "Log a transaction"}
      </button>

      {showForm && <AccountTransactionForm catalog={catalog} onAdd={(tx) => { addTransaction(account.id, tx); setShowForm(false); }} />}

      {txs.length === 0 ? (
        <Empty text="No transactions yet. Paid bills assigned to this account will show up here automatically." />
      ) : (
        <div className="ledger">
          {txs.map((t) => (
            <AccountTransactionRow key={t.id} t={t} catalog={catalog} updateTransaction={updateTransaction} deleteTransaction={deleteTransaction} />
          ))}
        </div>
      )}
    </Panel>
  );
}

// A manually-logged transaction (e.g. a cash-gig deposit) can be corrected
// after the fact — description, amount, date, type, category — right from
// the ledger row. Bill-generated transactions stay read-only here since
// editing them would drift out of sync with the bill's own payment record;
// fix those from the Bills page instead.
function AccountTransactionRow({ t, catalog, updateTransaction, deleteTransaction }) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(t.description);
  const [amount, setAmount] = useState(t.amount);
  const [type, setType] = useState(t.type);
  const [date, setDate] = useState(t.date?.slice(0, 10) || t.date);
  const [categoryId, setCategoryId] = useState(t.categoryId || "");
  const categories = catalog?.categories || [];
  const canEdit = t.source === "manual";

  const save = () => {
    if (!description || !amount) return;
    updateTransaction(t.id, { description, amount: Number(amount) || 0, type, date, categoryId: categoryId || null });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="ledger-row wrap">
        <span className="dot" style={{ background: type === "charge" ? "var(--rust)" : "var(--bottle)" }} />
        <input className="input input-small" style={{ flex: 1, minWidth: 140 }} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        <input className="input input-small col-amount-input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="input input-small" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="charge">Charge (money out)</option>
          <option value="payment">Deposit (money in)</option>
        </select>
        <input className="input input-small" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {categories.length > 0 && (
          <select className="input input-small" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">no category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button type="button" className="icon-btn" onClick={save} title="Save"><Check size={14} /></button>
        <button type="button" className="icon-btn" onClick={() => setEditing(false)} title="Cancel"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div className="ledger-row">
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
      {canEdit && (
        <button className="icon-btn" onClick={() => setEditing(true)} title="Edit transaction"><Pencil size={14} /></button>
      )}
      <button className="icon-btn" onClick={() => deleteTransaction(t.id)} title="Delete"><Trash2 size={14} /></button>
    </div>
  );
}

function AccountTransactionForm({ catalog, onAdd }) {
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
        <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, car payment, cash gig…" /></Field>
        <Field label="Amount"><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="charge">Charge (money out)</option>
            <option value="payment">Deposit (money in)</option>
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
