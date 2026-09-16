import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Check, Pencil, Trash2, History, MoreVertical, Tags } from "lucide-react";
import { money, fmtDate, todayISO, monthKey, monthLabel } from "../utils/format";
import { billDueInfo, billHistoryEntries, billEstimatedAmount, billScheduleEntries } from "../utils/bills";
import { fundingSource } from "../utils/funding";
import { isBillRelevantForMonth, monthLongLabel } from "../utils/months";
import { PageHeader, Panel, Field, Stat, Empty, Pill, FundingSourceSelect, MonthSwitcher } from "../components/ui/Primitives";

export default function BillsPage({ data, catalog, addBill, updateBill, deleteBill, toggleBillPaid, cardColor, selectedMonth, setSelectedMonth }) {
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () =>
      data.bills
        .filter((b) => isBillRelevantForMonth(b, data, selectedMonth))
        .slice()
        .sort((a, b) => billDueInfo(a, selectedMonth).due - billDueInfo(b, selectedMonth).due),
    [data, selectedMonth]
  );

  // Paid/unpaid split for whichever month is currently displayed — paid bills
  // count their actual recorded amount, unpaid ones their current estimate,
  // so the total tracks what BillRow shows for each bill below.
  const monthStats = useMemo(() => {
    let total = 0;
    let paid = 0;
    sorted.forEach((bill) => {
      const { key } = billDueInfo(bill, selectedMonth);
      const payment = data.billPayments[key]?.[bill.id];
      const amount = payment?.paid ? Number(payment.amount) : billEstimatedAmount(bill, key);
      total += amount;
      if (payment?.paid) paid += amount;
    });
    return { total, paid, unpaid: total - paid };
  }, [sorted, data, selectedMonth]);

  return (
    <div>
      <PageHeader title="Bills" subtitle="Recurring and one-time bills" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add bill"}
        </button>
      } />

      {adding && <AddBillForm data={data} catalog={catalog} onAdd={(b) => { addBill(b); setAdding(false); }} />}

      {sorted.length > 0 && (
        <div className="stat-row">
          <Stat label={`Total bills — ${monthLongLabel(selectedMonth)}`} value={money(monthStats.total)} tone="ink" />
          <Stat label="Paid" value={money(monthStats.paid)} tone="bottle" />
          <Stat label="Unpaid" value={money(monthStats.unpaid)} tone={monthStats.unpaid > 0 ? "rust" : "bottle"} />
        </div>
      )}

      <MonthSwitcher month={selectedMonth} setMonth={setSelectedMonth} />

      <Panel title={`Bills for ${monthLongLabel(selectedMonth)}`}>
        {data.bills.length === 0 ? (
          <Empty text="No bills yet. Add your first bill — recurring or one-time — to start tracking payments." />
        ) : sorted.length === 0 ? (
          <Empty text="No bills fall in this month." />
        ) : (
          <div className="ledger">
            {sorted.map((bill) => (
              <BillRow key={bill.id} bill={bill} data={data} catalog={catalog} referenceDate={selectedMonth} toggleBillPaid={toggleBillPaid} updateBill={updateBill} deleteBill={deleteBill} cardColor={cardColor} />
            ))}
          </div>
        )}
      </Panel>
      <p className="page-footnote">Looking for spending trends and history? Check the <strong>Analytics</strong> tab.</p>
    </div>
  );
}

export function BillRow({ bill, data, catalog, referenceDate, toggleBillPaid, updateBill, deleteBill, cardColor }) {
  const { due, key } = billDueInfo(bill, referenceDate);
  const payment = data.billPayments[key]?.[bill.id];
  const paid = !!payment?.paid;
  const estimate = billEstimatedAmount(bill, key);
  const overdue = !paid && due < new Date(todayISO());
  const isRecurring = (bill.frequency || "recurring") !== "onetime";
  const [editingPaid, setEditingPaid] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [amountDraft, setAmountDraft] = useState(estimate);
  const [paidDate, setPaidDate] = useState(payment?.paidDate || todayISO());
  const [cardId, setCardId] = useState(payment?.cardId || bill.cardId || "");
  const [amount, setAmount] = useState(payment?.amount ?? estimate);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const handleCheck = (e) => {
    toggleBillPaid(bill, key, e.target.checked, paidDate, cardId, amount);
    setEditingPaid(false);
  };

  const saveAmount = () => {
    const v = Number(amountDraft) || 0;
    // Editing the amount for the upcoming/current cycle is the same thing as
    // preloading it — write it into the schedule for this cycle's key rather
    // than the bill's running default, so it doesn't get clobbered by an
    // older schedule entry and so it plays by the same rules as amounts
    // preloaded further out (see BillTimeline below).
    updateBill(bill.id, { scheduledAmounts: { ...(bill.scheduledAmounts || {}), [key]: v } });
    setAmount(v);
    setEditingAmount(false);
  };

  const paidCardName = fundingSource(data, payment?.cardId)?.name;
  const category = (catalog?.categories || []).find((c) => c.id === bill.categoryId);
  const tags = (catalog?.tags || []).filter((t) => (bill.tagIds || []).includes(t.id));
  const history = isRecurring ? billHistoryEntries(bill, data) : [];
  const schedule = isRecurring ? billScheduleEntries(bill) : [];

  const statusLabel = paid ? "Paid" : overdue ? "Overdue" : "Unpaid";
  const statusClass = paid ? "paid" : overdue ? "overdue" : "unpaid";
  const hasMeta = !!category || tags.length > 0;

  return (
    <div className="bill-row-group">
      <div className="bill-row">
        <div className="bill-name-block">
          <span className="dot" style={{ background: bill.cardId ? cardColor(bill.cardId) : "var(--line)" }} />
          <span className="bill-name" title={bill.name}>{bill.name}</span>
          <span className="freq-tag">{isRecurring ? "monthly" : "one-time"}</span>
        </div>

        <span className="bill-due" style={{ color: overdue ? "var(--rust)" : "var(--ink-soft)" }}>{fmtDate(due)}</span>
        <span className="bill-amount">{money(paid ? payment.amount : estimate)}</span>

        <label className="paid-toggle">
          <input type="checkbox" checked={paid} onChange={handleCheck} />
          <span className={"status-chip status-" + statusClass}>
            {paid && <Check size={11} strokeWidth={3} />}
            {statusLabel}
          </span>
        </label>

        <div className="bill-menu" ref={menuRef}>
          <button type="button" className="bill-menu-btn" onClick={() => setMenuOpen((v) => !v)} title="More actions" aria-label="More actions" aria-expanded={menuOpen}>
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="bill-menu-pop">
              <button type="button" className="bill-menu-item" onClick={() => { setEditingTags((v) => !v); setMenuOpen(false); }}>
                <Tags size={13} /> Edit tags &amp; category
              </button>
              {!paid && (
                <button type="button" className="bill-menu-item" onClick={() => { setAmountDraft(estimate); setEditingAmount((v) => !v); setMenuOpen(false); }}>
                  <Pencil size={13} /> Edit amount owed
                </button>
              )}
              {paid && (
                <button type="button" className="bill-menu-item" onClick={() => { setEditingPaid((v) => !v); setMenuOpen(false); }}>
                  <Pencil size={13} /> Edit this payment
                </button>
              )}
              {isRecurring && (
                <button type="button" className="bill-menu-item" onClick={() => { setShowHistory((v) => !v); setMenuOpen(false); }}>
                  <History size={13} /> {showHistory ? "Hide history & schedule" : "History & schedule"}
                </button>
              )}
              <div className="bill-menu-divider" />
              <button type="button" className="bill-menu-item danger" onClick={() => { deleteBill(bill.id); setMenuOpen(false); }}>
                <Trash2 size={13} /> Delete bill
              </button>
            </div>
          )}
        </div>
      </div>

      {!editingTags && !editingAmount && (hasMeta || (paid && !editingPaid)) && (
        <div className="bill-row-meta">
          <span className="bill-badges">
            {category && <Pill item={category} />}
            {tags.map((t) => <Pill key={t.id} item={t} />)}
          </span>
          {paid && !editingPaid && (
            <span className="bill-paid-summary">{fmtDate(payment.paidDate)} · {money(payment.amount)} · {paidCardName || "no card noted"}</span>
          )}
        </div>
      )}

      {editingTags && (
        <div className="bill-row-edit">
          <button type="button" className="icon-btn bill-row-edit-close" onClick={() => setEditingTags(false)} title="Cancel"><X size={13} /></button>
          <CategoryTagEditor
            catalog={catalog}
            categoryId={bill.categoryId}
            tagIds={bill.tagIds || []}
            onSave={(patch) => { updateBill(bill.id, patch); setEditingTags(false); }}
          />
        </div>
      )}

      {!paid && editingAmount && (
        <div className="bill-row-edit paid-summary">
          <span>New amount owed:</span>
          <input type="number" step="0.01" className="input input-small col-amount-input" value={amountDraft} autoFocus onChange={(e) => setAmountDraft(e.target.value)} />
          <button type="button" className="icon-btn" onClick={saveAmount} title="Save"><Check size={14} /></button>
          <button type="button" className="icon-btn" onClick={() => setEditingAmount(false)} title="Cancel"><X size={13} /></button>
        </div>
      )}

      {paid && editingPaid && (
        <div className="bill-row-edit paid-summary">
          <input type="date" className="input input-small" value={paidDate} onChange={(e) => { setPaidDate(e.target.value); toggleBillPaid(bill, key, true, e.target.value, cardId, amount); }} />
          <input type="number" step="0.01" className="input input-small col-amount-input" value={amount} onChange={(e) => { const v = e.target.value; setAmount(v); toggleBillPaid(bill, key, true, paidDate, cardId, v); }} />
          <FundingSourceSelect
            data={data}
            value={cardId}
            onChange={(v) => { setCardId(v); toggleBillPaid(bill, key, true, paidDate, v, amount); }}
            allowNone
            className="input input-small"
          />
          <button type="button" className="icon-btn" onClick={() => setEditingPaid(false)} title="Lock in"><Check size={14} /></button>
        </div>
      )}

      {showHistory && (
        <BillTimeline bill={bill} data={data} history={history} schedule={schedule} currentKey={key} toggleBillPaid={toggleBillPaid} updateBill={updateBill} />
      )}
    </div>
  );
}

// Expandable per-bill panel covering both directions of a usage-dependent
// recurring bill (rent+utilities, electric, cell phone): past months whose
// actual charge you want on record (for Analytics), and future months whose
// amount you already know (e.g. a provider-issued billing schedule) and want
// the forecast to use instead of repeating the last paid amount.
function BillTimeline({ bill, data, history, schedule, currentKey, toggleBillPaid, updateBill }) {
  const [addingPast, setAddingPast] = useState(false);
  const [pastDate, setPastDate] = useState(todayISO());
  const [pastAmount, setPastAmount] = useState("");
  const [pastCardId, setPastCardId] = useState(bill.cardId || "");

  const [addingFuture, setAddingFuture] = useState(false);
  const [futureMonth, setFutureMonth] = useState(currentKey.startsWith("once-") ? "" : currentKey);
  const [futureAmount, setFutureAmount] = useState("");

  const savePast = (e) => {
    e.preventDefault();
    if (!pastAmount) return;
    const mk = monthKey(new Date(pastDate));
    toggleBillPaid(bill, mk, true, pastDate, pastCardId, pastAmount);
    setAddingPast(false);
    setPastAmount("");
  };

  const removePast = (entryKey) => toggleBillPaid(bill, entryKey, false);

  const saveFuture = (e) => {
    e.preventDefault();
    if (!futureMonth || !futureAmount) return;
    updateBill(bill.id, { scheduledAmounts: { ...(bill.scheduledAmounts || {}), [futureMonth]: Number(futureAmount) } });
    setAddingFuture(false);
    setFutureAmount("");
  };

  const removeFuture = (entryKey) => {
    const { [entryKey]: _dropped, ...rest } = bill.scheduledAmounts || {};
    updateBill(bill.id, { scheduledAmounts: rest });
  };

  return (
    <div className="bill-timeline">
      <div className="bill-timeline-col">
        <div className="bill-timeline-head">Upcoming schedule</div>
        {schedule.length === 0 ? (
          <p className="muted-text">No amounts preloaded yet. Got a billing schedule from the provider? Add each month's amount ahead of time so the forecast uses it instead of repeating the last bill.</p>
        ) : (
          <div className="bill-history-list">
            {schedule.map((s) => (
              <div className="bill-history-row" key={s.key}>
                <span>{monthLabel(s.key)}</span>
                <span>{money(s.amount)}</span>
                <button type="button" className="icon-btn" onClick={() => removeFuture(s.key)} title="Remove"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {addingFuture ? (
          <form className="bill-history-form" onSubmit={saveFuture}>
            <input type="month" className="input input-small" min={currentKey} value={futureMonth} onChange={(e) => setFutureMonth(e.target.value)} autoFocus />
            <input type="number" step="0.01" className="input input-small col-amount-input" placeholder="Amount" value={futureAmount} onChange={(e) => setFutureAmount(e.target.value)} />
            <button type="submit" className="icon-btn" title="Save"><Check size={14} /></button>
            <button type="button" className="icon-btn" onClick={() => setAddingFuture(false)} title="Cancel"><X size={14} /></button>
          </form>
        ) : (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setAddingFuture(true)}><Plus size={13} /> Preload a month's amount</button>
        )}
      </div>

      <div className="bill-timeline-col">
        <div className="bill-timeline-head">Past payments</div>
        {history.length === 0 ? (
          <p className="muted-text">No past months recorded yet.</p>
        ) : (
          <div className="bill-history-list">
            {history.slice().reverse().map((h) => (
              <div className="bill-history-row" key={h.key}>
                <span>{monthLabel(h.key)}</span>
                <span>{money(h.amount)}</span>
                <span className="muted-text">{fundingSource(data, h.cardId)?.name || "no card noted"}</span>
                {h.key !== currentKey && (
                  <button type="button" className="icon-btn" onClick={() => removePast(h.key)} title="Remove this record"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )}
        {addingPast ? (
          <form className="bill-history-form" onSubmit={savePast}>
            <input type="date" className="input input-small" max={todayISO()} value={pastDate} onChange={(e) => setPastDate(e.target.value)} autoFocus />
            <input type="number" step="0.01" className="input input-small col-amount-input" placeholder="Amount" value={pastAmount} onChange={(e) => setPastAmount(e.target.value)} />
            <FundingSourceSelect data={data} value={pastCardId} onChange={setPastCardId} allowNone className="input input-small" />
            <button type="submit" className="icon-btn" title="Save"><Check size={14} /></button>
            <button type="button" className="icon-btn" onClick={() => setAddingPast(false)} title="Cancel"><X size={14} /></button>
          </form>
        ) : (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setAddingPast(true)}><Plus size={13} /> Log a past month</button>
        )}
      </div>
    </div>
  );
}

// Inline category (single) + tags (multi) picker, drawing only from the
// shared admin-curated catalog — reused by BillRow.
function CategoryTagEditor({ catalog, categoryId, tagIds, onSave }) {
  const [catId, setCatId] = useState(categoryId || "");
  const [selectedTagIds, setSelectedTagIds] = useState(tagIds);
  const categories = catalog?.categories || [];
  const tags = catalog?.tags || [];

  const toggleTag = (id) => setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="edit-form" style={{ width: "100%" }}>
      <Field label="Category">
        <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">no category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {tags.length > 0 && (
        <Field label="Tags">
          <div className="chip-row">
            {tags.map((t) => (
              <button
                type="button"
                key={t.id}
                className={"chip" + (selectedTagIds.includes(t.id) ? " active" : "")}
                style={selectedTagIds.includes(t.id) ? { background: t.color, borderColor: t.color, color: "#fff" } : {}}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      )}
      {categories.length === 0 && tags.length === 0 && (
        <p className="hint">No tags or categories yet — an admin can add some in the Admin Console.</p>
      )}
      <button type="button" className="btn btn-primary btn-small" onClick={() => onSave({ categoryId: catId || null, tagIds: selectedTagIds })}>
        <Check size={13} /> Save
      </button>
    </div>
  );
}

function AddBillForm({ data, catalog, onAdd }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("recurring");
  const [dueDay, setDueDay] = useState("1");
  const [dueDate, setDueDate] = useState(todayISO());
  const [cardId, setCardId] = useState(data.cards[0]?.id || (data.bankAccounts || [])[0]?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState([]);
  const categories = catalog?.categories || [];
  const tags = catalog?.tags || [];

  const toggleTag = (id) => setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = (e) => {
    e.preventDefault();
    if (!name || !amount) return;
    const bill = { name, amount: Number(amount), cardId, frequency, categoryId: categoryId || null, tagIds };
    if (frequency === "recurring") bill.dueDay = Number(dueDay);
    else bill.dueDate = dueDate;
    onAdd(bill);
    setName(""); setAmount(""); setDueDay("1"); setDueDate(todayISO()); setCategoryId(""); setTagIds([]);
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Bill name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent, electric, internet…" /></Field>
        <Field label="Amount"><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Frequency">
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="recurring">Recurring monthly</option>
            <option value="onetime">One-time</option>
          </select>
        </Field>
        {frequency === "recurring" ? (
          <Field label="Due day of month"><input className="input" type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
        ) : (
          <Field label="Due date"><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        )}
        <Field label="Usually paid with">
          <FundingSourceSelect data={data} value={cardId} onChange={setCardId} allowNone />
        </Field>
        <Field label="Category">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">no category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      {tags.length > 0 && (
        <Field label="Tags">
          <div className="chip-row">
            {tags.map((t) => (
              <button
                type="button"
                key={t.id}
                className={"chip" + (tagIds.includes(t.id) ? " active" : "")}
                style={tagIds.includes(t.id) ? { background: t.color, borderColor: t.color, color: "#fff" } : {}}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      )}
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add bill</button>
    </form>
  );
}
