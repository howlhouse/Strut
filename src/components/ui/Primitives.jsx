import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { PALETTE } from "../../utils/constants";
import { cardOptionLabel, accountOptionLabel } from "../../utils/funding";
import { addMonths, isSameMonth, monthLongLabel, startOfMonth } from "../../utils/months";

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2 className="panel-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, right, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color: `var(--${tone})` }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Empty({ text }) {
  return <p className="empty">{text}</p>;
}

// Small colored pill for a shared catalog tag/category entry.
export function Pill({ item }) {
  return <span className="pill" style={{ background: item.color || "var(--ink-soft)" }}>{item.name}</span>;
}

// A row of curated color swatches plus a raw color input, used wherever an
// admin picks a tag/category color.
export function ColorSwatchPicker({ value, onChange }) {
  return (
    <div className="swatch-row">
      {PALETTE.map((c) => (
        <button
          type="button"
          key={c}
          className={"swatch" + (value === c ? " active" : "")}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
      <input type="color" className="swatch-custom" value={value} onChange={(e) => onChange(e.target.value)} title="Custom color" />
    </div>
  );
}

// Shared funding-source picker for bills, transactions, and layaway
// payments — everywhere someone chooses which card or bank account a
// payment comes from. Grouped so a checking account used for something
// like a car payment is just as pickable as a credit card.
export function FundingSourceSelect({ data, value, onChange, allowNone, className }) {
  const cards = data.cards || [];
  const accounts = data.bankAccounts || [];
  return (
    <select className={className || "input"} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">no card</option>}
      {cards.length > 0 && (
        <optgroup label="Cards">
          {cards.map((c) => <option key={c.id} value={c.id}>{cardOptionLabel(c)}</option>)}
        </optgroup>
      )}
      {accounts.length > 0 && (
        <optgroup label="Bank accounts">
          {accounts.map((a) => <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>)}
        </optgroup>
      )}
    </select>
  );
}

// Controlled multi-select chip row for picking tags from the shared catalog —
// no internal state or save button, so it drops into any form's own submit flow.
export function TagChipPicker({ tags, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="chip-row">
      {tags.map((t) => (
        <button
          type="button"
          key={t.id}
          className={"chip" + (value.includes(t.id) ? " active" : "")}
          style={value.includes(t.id) ? { background: t.color, borderColor: t.color, color: "#fff" } : {}}
          onClick={() => toggle(t.id)}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

export function MonthSwitcher({ month, setMonth }) {
  const isCurrent = isSameMonth(month, new Date());
  return (
    <div className="month-switcher">
      <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} title="Previous month"><ChevronLeft size={16} /></button>
      <span className="month-switcher-label">{monthLongLabel(month)}</span>
      <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} title="Next month"><ChevronRight size={16} /></button>
      {!isCurrent && (
        <button className="btn btn-ghost btn-small" onClick={() => setMonth(startOfMonth(new Date()))}>Today</button>
      )}
    </div>
  );
}
