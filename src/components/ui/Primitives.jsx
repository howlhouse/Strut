import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { PALETTE } from "../../utils/constants";
import { addMonths, isSameMonth, monthLongLabel, startOfMonth } from "../../utils/months";

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={"modal-panel" + (wide ? " modal-wide" : "")} onClick={(e) => e.stopPropagation()}>
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
