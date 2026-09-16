import { useState } from "react";
import { Plus, X, Check, Pencil, Trash2, ExternalLink } from "lucide-react";
import { money, todayISO, uid } from "../utils/format";
import { cardOptionLabel } from "../utils/funding";
import { PageHeader, Panel, Field, Empty } from "../components/ui/Primitives";

export default function LayawayPage({ data, addFestival, deleteFestival, updateFestivalMeta, toggleInstallmentPaid, addInstallment, deleteInstallment, updateInstallment, cardColor }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader title="Layaway Payments" subtitle="Installment plans for festivals, flex pay, and other financed items" action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add plan"}
        </button>
      } />

      {adding && <AddFestivalForm cards={data.cards} onAdd={(f) => { addFestival(f); setAdding(false); }} />}

      {data.layaways.length === 0 ? (
        <Panel title="Plans"><Empty text="No layaway plans yet. Add a festival, flex-pay purchase, or other financed item to build a payment schedule." /></Panel>
      ) : (
        <div className="tile-grid">
          {data.layaways.map((fest) => (
            <FestivalTile
              key={fest.id}
              fest={fest}
              cards={data.cards}
              toggleInstallmentPaid={toggleInstallmentPaid}
              deleteFestival={deleteFestival}
              updateFestivalMeta={updateFestivalMeta}
              addInstallment={addInstallment}
              deleteInstallment={deleteInstallment}
              updateInstallment={updateInstallment}
              cardColor={cardColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FestivalTile({ fest, cards, toggleInstallmentPaid, deleteFestival, updateFestivalMeta, addInstallment, deleteInstallment, updateInstallment, cardColor }) {
  const [editing, setEditing] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const total = fest.installments.reduce((s, i) => s + Number(i.amount), 0);
  const paidTotal = fest.installments.filter((i) => i.paid).reduce((s, i) => s + Number(i.amount), 0);
  const pct = total ? Math.round((paidTotal / total) * 100) : 0;
  const tileColor = fest.cardId ? cardColor(fest.cardId) : "var(--brass)";

  return (
    <section className="event-tile" style={{ borderTopColor: tileColor }}>
      <div className="tile-head">
        <div>
          <h2 className="panel-title">{fest.festivalName}</h2>
          {fest.itemName && <p className="tile-sub">{fest.itemName}</p>}
        </div>
        <div className="tile-head-actions">
          <button className="icon-btn" onClick={() => setEditing((v) => !v)} title="Edit details">{editing ? <X size={14} /> : <Pencil size={14} />}</button>
          <button className="icon-btn" onClick={() => deleteFestival(fest.id)} title="Delete plan"><Trash2 size={14} /></button>
        </div>
      </div>

      {editing ? (
        <FestivalMetaForm fest={fest} cards={cards} onSave={(patch) => { updateFestivalMeta(fest.id, patch); setEditing(false); }} />
      ) : (
        <div className="tile-details">
          {fest.eventDetails && <p className="details-text">{fest.eventDetails}</p>}
          {fest.ticketUrl && (
            <a className="link-row" href={fest.ticketUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> Tracking link
            </a>
          )}
          {fest.notes && <p className="muted-text">{fest.notes}</p>}
          <p className="muted-text">Card: {fest.cardId ? cards.find((c) => c.id === fest.cardId)?.name || "—" : "none set"}</p>
        </div>
      )}

      <div className="progress-row">
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, backgroundImage: "var(--rainbow)" }} /></div>
        <span className="progress-label">{money(paidTotal)} of {money(total)} paid</span>
      </div>

      <div className="ledger">
        {fest.installments.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((inst) => (
          <InstallmentRow key={inst.id} fest={fest} inst={inst} toggleInstallmentPaid={toggleInstallmentPaid} deleteInstallment={deleteInstallment} updateInstallment={updateInstallment} color={tileColor} />
        ))}
      </div>

      {addingPayment ? (
        <AddInstallmentForm onAdd={(entry) => { addInstallment(fest.id, entry); setAddingPayment(false); }} onCancel={() => setAddingPayment(false)} />
      ) : (
        <button className="btn btn-ghost btn-small" style={{ marginTop: 10 }} onClick={() => setAddingPayment(true)}>
          <Plus size={14} /> Add payment
        </button>
      )}
    </section>
  );
}

function InstallmentRow({ fest, inst, toggleInstallmentPaid, deleteInstallment, updateInstallment, color }) {
  const [amount, setAmount] = useState(inst.amount);
  const [dueDate, setDueDate] = useState(inst.dueDate?.slice(0, 10) || inst.dueDate);

  return (
    <div className="ledger-row wrap">
      <span className="dot" style={{ background: color }} />
      <input
        className="input input-small col-date-input"
        type="date"
        value={dueDate}
        disabled={inst.paid}
        onChange={(e) => { setDueDate(e.target.value); updateInstallment(fest.id, inst.id, { dueDate: e.target.value }); }}
      />
      <input
        className="input input-small col-amount-input"
        type="number"
        step="0.01"
        value={amount}
        disabled={inst.paid}
        onChange={(e) => { setAmount(e.target.value); updateInstallment(fest.id, inst.id, { amount: Number(e.target.value) || 0 }); }}
      />
      <label className="paid-toggle">
        <input type="checkbox" checked={!!inst.paid} onChange={(e) => toggleInstallmentPaid(fest, inst, e.target.checked, todayISO())} />
        <span className={inst.paid ? "tag tag-paid" : "tag tag-unpaid"}>{inst.paid ? "Paid" : "Unpaid"}</span>
      </label>
      <button className="icon-btn" onClick={() => deleteInstallment(fest.id, inst.id)} title="Delete payment"><Trash2 size={14} /></button>
    </div>
  );
}

function AddInstallmentForm({ onAdd, onCancel }) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const submit = (e) => {
    e.preventDefault();
    if (!amount || !dueDate) return;
    onAdd({ amount, dueDate });
  };
  return (
    <form className="add-row-form" onSubmit={submit}>
      <input className="input input-small" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <input className="input input-small" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button className="btn btn-primary btn-small" type="submit"><Plus size={13} /> Add</button>
      <button className="btn btn-ghost btn-small" type="button" onClick={onCancel}><X size={13} /></button>
    </form>
  );
}

function FestivalMetaForm({ fest, cards, onSave }) {
  const [festivalName, setFestivalName] = useState(fest.festivalName);
  const [itemName, setItemName] = useState(fest.itemName || "");
  const [ticketUrl, setTicketUrl] = useState(fest.ticketUrl || "");
  const [eventDetails, setEventDetails] = useState(fest.eventDetails || "");
  const [notes, setNotes] = useState(fest.notes || "");
  const [cardId, setCardId] = useState(fest.cardId || "");

  const submit = (e) => {
    e.preventDefault();
    onSave({ festivalName, itemName, ticketUrl, eventDetails, notes, cardId });
  };

  return (
    <form className="edit-form" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Item or plan name"><input className="input" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} /></Field>
        <Field label="Item"><input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} /></Field>
        <Field label="Tracking link"><input className="input" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="Card">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">no card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Details"><textarea className="input textarea" value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Dates, vendor, plan details…" /></Field>
      <Field label="Notes"><textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth keeping track of…" /></Field>
      <button className="btn btn-primary btn-small" type="submit" style={{ marginTop: 4 }}><Check size={14} /> Save details</button>
    </form>
  );
}

function AddFestivalForm({ cards, onAdd }) {
  const [festivalName, setFestivalName] = useState("");
  const [itemName, setItemName] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [cardId, setCardId] = useState(cards[0]?.id || "");

  const [mode, setMode] = useState("auto"); // 'auto' | 'preset'

  // auto-split fields
  const [totalAmount, setTotalAmount] = useState("");
  const [numPayments, setNumPayments] = useState("4");
  const [firstDue, setFirstDue] = useState(todayISO());
  const [interval, setInterval_] = useState("monthly");

  // preset schedule rows
  const [rows, setRows] = useState([{ amount: "", dueDate: todayISO() }]);
  const updateRow = (idx, patch) => setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const addRow = () => setRows((r) => [...r, { amount: "", dueDate: todayISO() }]);
  const removeRow = (idx) => setRows((r) => r.filter((_, i) => i !== idx));

  const submit = (e) => {
    e.preventDefault();
    if (!festivalName) return;

    let installments = [];
    if (mode === "auto") {
      if (!totalAmount || !numPayments) return;
      const n = Number(numPayments);
      const total = Number(totalAmount);
      const base = Math.floor((total / n) * 100) / 100;
      const remainder = Math.round((total - base * n) * 100) / 100;
      let d = new Date(firstDue);
      for (let i = 0; i < n; i++) {
        const amt = i === n - 1 ? base + remainder : base;
        installments.push({ id: uid(), amount: amt, dueDate: d.toISOString().slice(0, 10), paid: false, paidDate: null, txId: null });
        d = new Date(d);
        if (interval === "weekly") d.setDate(d.getDate() + 7);
        else if (interval === "biweekly") d.setDate(d.getDate() + 14);
        else d.setMonth(d.getMonth() + 1);
      }
    } else {
      installments = rows
        .filter((r) => r.amount && r.dueDate)
        .map((r) => ({ id: uid(), amount: Number(r.amount), dueDate: r.dueDate, paid: false, paidDate: null, txId: null }));
      if (installments.length === 0) return;
    }

    const total = installments.reduce((s, i) => s + i.amount, 0);
    onAdd({ festivalName, itemName, ticketUrl, eventDetails, notes, cardId, totalAmount: total, installments });
    setFestivalName(""); setItemName(""); setTicketUrl(""); setEventDetails(""); setNotes("");
    setTotalAmount(""); setNumPayments("4"); setFirstDue(todayISO()); setRows([{ amount: "", dueDate: todayISO() }]);
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Item or plan name"><input className="input" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} placeholder="e.g. Okeechobee, Affirm — sofa, Klarna order" /></Field>
        <Field label="Item (optional)"><input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="GA ticket, camping, sectional couch…" /></Field>
        <Field label="Tracking link (optional)"><input className="input" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="Card">
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">no card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Details (optional)"><textarea className="input textarea" value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Dates, vendor, plan details…" /></Field>
      <Field label="Notes (optional)"><textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth keeping track of…" /></Field>

      <div className="segmented" style={{ margin: "14px 0 12px" }}>
        <button type="button" className={"segment" + (mode === "auto" ? " active" : "")} onClick={() => setMode("auto")}>Auto-split evenly</button>
        <button type="button" className={"segment" + (mode === "preset" ? " active" : "")} onClick={() => setMode("preset")}>Vendor's payment schedule</button>
      </div>

      {mode === "auto" ? (
        <div className="form-grid">
          <Field label="Total amount"><input className="input" type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Number of payments"><input className="input" type="number" min="1" value={numPayments} onChange={(e) => setNumPayments(e.target.value)} /></Field>
          <Field label="First payment date"><input className="input" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></Field>
          <Field label="Frequency">
            <select className="input" value={interval} onChange={(e) => setInterval_(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
        </div>
      ) : (
        <div>
          <p className="hint" style={{ marginTop: 0 }}>Enter the exact amount and date for each payment from the vendor's plan.</p>
          {rows.map((row, idx) => (
            <div className="add-row-form" key={idx}>
              <input className="input input-small" type="date" value={row.dueDate} onChange={(e) => updateRow(idx, { dueDate: e.target.value })} />
              <input className="input input-small" type="number" step="0.01" placeholder="0.00" value={row.amount} onChange={(e) => updateRow(idx, { amount: e.target.value })} />
              {rows.length > 1 && <button type="button" className="icon-btn" onClick={() => removeRow(idx)}><Trash2 size={14} /></button>}
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-small" onClick={addRow}><Plus size={13} /> Add another payment</button>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary" type="submit"><Plus size={15} /> Create plan</button>
      </div>
    </form>
  );
}
