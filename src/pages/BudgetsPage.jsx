import { useState, useMemo } from "react";
import { Plus, X, Check, Pencil, Trash2 } from "lucide-react";
import { money } from "../utils/format";
import { PALETTE } from "../utils/constants";
import { budgetSpentThisMonth, netMoneyPostBudget } from "../utils/netMoney";
import { PageHeader, Panel, Field, Stat, Empty, Pill, ColorSwatchPicker } from "../components/ui/Primitives";

export default function BudgetsPage({ data, catalog, addBudget, updateBudget, deleteBudget, addCategory, isAdmin }) {
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
