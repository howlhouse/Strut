import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Plus, X, Trash2 } from "lucide-react";
import { money, fmtDate, todayISO } from "../utils/format";
import { computeCashForecast } from "../utils/forecast";
import { COLOR_BOTTLE } from "../utils/constants";
import { PageHeader, Panel, Field, Stat, Empty } from "../components/ui/Primitives";

export default function ForecastPage({ data, addIncome, deleteIncome }) {
  const accounts = data.bankAccounts || [];
  const incomes = data.incomes || [];
  const [selectedIds, setSelectedIds] = useState(accounts.map((a) => a.id));
  const [horizonDays, setHorizonDays] = useState(90);
  const [addingIncome, setAddingIncome] = useState(false);

  useEffect(() => {
    setSelectedIds((prev) => {
      const stillValid = prev.filter((id) => accounts.some((a) => a.id === id));
      return stillValid.length > 0 || accounts.length === 0 ? stillValid : accounts.map((a) => a.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const toggleAccount = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const result = useMemo(
    () => (selectedIds.length > 0 ? computeCashForecast(data, selectedIds, horizonDays) : null),
    [data, selectedIds, horizonDays]
  );

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Forecast" subtitle="Mock your ledger forward through upcoming paychecks and bills" />
        <Panel title="Add a bank account first">
          <Empty text="The forecast projects your bank account balances forward. Add a checking or savings account on the Bank Accounts tab to get started." />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Forecast" subtitle="Mock your ledger forward through upcoming paychecks and bills" />

      <Panel title="Included accounts">
        <div className="check-list">
          {accounts.map((a) => (
            <label className="check-item" key={a.id}>
              <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleAccount(a.id)} />
              <span>{a.name}</span>
              <span className="muted-text">{money(a.balance)}</span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Paychecks & recurring income" right={
        <button className="btn btn-primary btn-small" onClick={() => setAddingIncome((v) => !v)}>
          {addingIncome ? <X size={13} /> : <Plus size={13} />} {addingIncome ? "Close" : "Add income"}
        </button>
      }>
        {addingIncome && <AddIncomeForm accounts={accounts} onAdd={(i) => { addIncome(i); setAddingIncome(false); }} />}
        {incomes.length === 0 ? (
          <Empty text="No recurring income yet. Add your paycheck schedule so the forecast can add it in." />
        ) : (
          <div className="ledger">
            {incomes.map((inc) => (
              <IncomeRow key={inc.id} income={inc} accounts={accounts} deleteIncome={deleteIncome} />
            ))}
          </div>
        )}
      </Panel>

      {!result ? (
        <Panel title="Projected balance"><Empty text="Select at least one account above to see a projection." /></Panel>
      ) : (
        <>
          <Panel
            title="Projected balance"
            right={
              <div className="segmented">
                {[30, 60, 90, 180].map((h) => (
                  <button key={h} className={"segment" + (horizonDays === h ? " active" : "")} onClick={() => setHorizonDays(h)}>{h}d</button>
                ))}
              </div>
            }
          >
            <div className="stat-row" style={{ marginBottom: 16 }}>
              <Stat label="Starting balance" value={money(result.startingBalance)} tone="ink" />
              <Stat label={`Balance in ${horizonDays} days`} value={money(result.endingBalance)} tone={result.endingBalance >= result.startingBalance ? "bottle" : "rust"} />
              <Stat label="Projected income" value={money(result.totalIncome)} tone="bottle" />
              <Stat label="Projected bills & payments" value={money(Math.abs(result.totalExpenses))} tone="rust" />
            </div>
            <CashForecastChart series={result.series} />
            <p className="hint" style={{ marginTop: 4 }}>
              Assumes every bill and layaway payment leaves your account on its due date, and includes only the recurring income you've added above.
            </p>
          </Panel>

          <Panel title="Timeline">
            {result.timeline.length === 0 ? (
              <Empty text="Nothing scheduled in this window besides your starting balance." />
            ) : (
              <div className="ledger">
                {result.timeline.map((e, idx) => (
                  <div className="ledger-row" key={idx}>
                    <span className="dot" style={{ background: e.kind === "income" ? "var(--bottle)" : "var(--rust)" }} />
                    <span className="col-name">{e.label}</span>
                    <span className="col-date">{fmtDate(e.date)}</span>
                    <span className="col-amount" style={{ color: e.kind === "income" ? "var(--bottle)" : "var(--rust)" }}>
                      {e.amount > 0 ? "+" : "−"}{money(Math.abs(e.amount))}
                    </span>
                    <span className="col-balance">{money(e.balanceAfter)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function CashForecastChart({ series }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_BOTTLE} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COLOR_BOTTLE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={30} />
          <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`} width={52} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
            formatter={(v) => [money(v), "Balance"]}
          />
          <Area type="stepAfter" dataKey="balance" stroke={COLOR_BOTTLE} strokeWidth={2} fill="url(#forecast-grad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function IncomeRow({ income, accounts, deleteIncome }) {
  const accountName = accounts.find((a) => a.id === income.accountId)?.name || "no account";
  const freqLabel = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly" }[income.frequency] || income.frequency;
  return (
    <div className="ledger-row">
      <span className="dot" style={{ background: "var(--bottle)" }} />
      <span className="col-name">{income.name}</span>
      <span className="col-card">{accountName}</span>
      <span className="col-date" style={{ width: 100 }}>{freqLabel}</span>
      <span className="col-amount">{money(income.amount)}</span>
      <button className="icon-btn" onClick={() => deleteIncome(income.id)} title="Delete income"><Trash2 size={14} /></button>
    </div>
  );
}

function AddIncomeForm({ accounts, onAdd }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [frequency, setFrequency] = useState("biweekly");
  const [startDate, setStartDate] = useState(todayISO());

  const submit = (e) => {
    e.preventDefault();
    if (!name || !amount || !accountId) return;
    onAdd({ name, amount: Number(amount), accountId, frequency, startDate });
    setName(""); setAmount("");
  };

  return (
    <form className="panel form-panel form-panel-tight" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paycheck" /></Field>
        <Field label="Amount"><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Deposit account">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Frequency">
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Next pay date"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
      </div>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add income</button>
    </form>
  );
}
