import { useState } from "react";
import { Field } from "../components/ui/Primitives";
import { EventImage } from "./EventTile";
import { AGE_OPTIONS, EVENT_CATEGORIES, STATUS_LABEL, blankEvent, cleanEventFields, safeUrl, validateEvent } from "./eventUtils";

// Add/edit form for a listing. Promoters see only the event details; with
// `adminMode` the admin-only block (status, fee, featured) is added.
// onSubmit receives (fields, adminFields) — adminFields is null for
// promoters, so they can never send those keys at all.
export default function EventForm({ initial, adminMode, submitLabel, onSubmit, onCancel }) {
  const [f, setF] = useState(() => ({ ...blankEvent(), ...(initial || {}) }));
  const [admin, setAdmin] = useState(() => ({
    status: initial?.status || "published",
    featured: !!initial?.featured,
    feeAmount: initial?.feeAmount ?? 0,
    feePaid: !!initial?.feePaid,
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateEvent(f);
    if (problem) { setError(problem); return; }
    setError("");
    setSaving(true);
    // onSubmit resolves to false when the write failed (the page then keeps
    // this form open so nothing typed is lost).
    const ok = await onSubmit(
      cleanEventFields(f),
      adminMode ? { ...admin, feeAmount: Math.max(0, Number(admin.feeAmount) || 0) } : null,
    ).catch(() => false);
    if (ok === false) {
      setError("Couldn't save — check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Field label="Event title *">
        <input className="input" value={f.title} onChange={set("title")} maxLength={120} autoFocus />
      </Field>

      <div className="form-grid">
        <Field label="Category">
          <select className="input" value={f.category} onChange={set("category")}>
            {EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Age">
          <select className="input" value={f.ageRestriction} onChange={set("ageRestriction")}>
            {AGE_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Date *"><input className="input" type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="End date (multi-day)"><input className="input" type="date" value={f.endDate} min={f.date || undefined} onChange={set("endDate")} /></Field>
        <Field label="Starts"><input className="input" type="time" value={f.startTime} onChange={set("startTime")} /></Field>
        <Field label="Ends"><input className="input" type="time" value={f.endTime} onChange={set("endTime")} /></Field>
      </div>

      <div className="form-grid">
        <Field label="Venue name"><input className="input" value={f.venueName} onChange={set("venueName")} maxLength={120} /></Field>
        <Field label="Address"><input className="input" value={f.address} onChange={set("address")} maxLength={200} placeholder="Street, city" /></Field>
      </div>

      <Field label="Description">
        <textarea className="input" rows={5} value={f.description} onChange={set("description")} maxLength={5000} />
      </Field>

      <Field label="Image URL (shown on the event tile)">
        <input className="input" value={f.imageUrl} onChange={set("imageUrl")} placeholder="https://…/poster.jpg" inputMode="url" />
      </Field>
      {safeUrl(f.imageUrl) && (
        <div className="event-form-preview">
          <EventImage key={safeUrl(f.imageUrl)} url={f.imageUrl} category={f.category} className="event-tile-img" />
        </div>
      )}

      <div className="form-grid">
        <Field label="Ticket URL"><input className="input" value={f.ticketUrl} onChange={set("ticketUrl")} placeholder="https://…" inputMode="url" /></Field>
        <Field label="Price"><input className="input" value={f.price} onChange={set("price")} maxLength={60} placeholder="Free, $20, $15–$40…" /></Field>
        <Field label="Presented by"><input className="input" value={f.organizerName} onChange={set("organizerName")} maxLength={120} /></Field>
        <Field label="Website / social link"><input className="input" value={f.websiteUrl} onChange={set("websiteUrl")} placeholder="https://…" inputMode="url" /></Field>
        <Field label="Contact email (shown publicly)"><input className="input" type="email" value={f.contactEmail} onChange={set("contactEmail")} /></Field>
      </div>

      {adminMode && (
        <div className="event-form-admin">
          <div className="event-form-admin-title">Admin</div>
          <div className="form-grid">
            <Field label="Status">
              <select className="input" value={admin.status} onChange={(e) => setAdmin({ ...admin, status: e.target.value })}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Listing fee ($)">
              <input className="input" type="number" min="0" step="0.01" value={admin.feeAmount} onChange={(e) => setAdmin({ ...admin, feeAmount: e.target.value })} />
            </Field>
          </div>
          <label className="check-item">
            <input type="checkbox" checked={admin.feePaid} onChange={(e) => setAdmin({ ...admin, feePaid: e.target.checked })} />
            <span>Listing fee paid</span>
          </label>
          <label className="check-item">
            <input type="checkbox" checked={admin.featured} onChange={(e) => setAdmin({ ...admin, featured: e.target.checked })} />
            <span>Feature at the top of the Events page</span>
          </label>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : submitLabel || "Save event"}</button>
      </div>
    </form>
  );
}
