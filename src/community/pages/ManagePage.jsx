import { useState } from "react";
import { Plus, Pencil, Trash2, Star, Check, X, Eye } from "lucide-react";
import { PageHeader, Panel, Empty, Modal, Stat } from "../../components/ui/Primitives";
import { money } from "../../utils/format";
import { EventImage } from "../EventTile";
import EventForm from "../EventForm";
import { STATUS_LABEL, byStart, fmtEventWhen } from "../eventUtils";

// Admin console for the community calendar: review submissions, take or
// record listing fees, feature events, and post on a promoter's behalf.
// `profiles` maps ownerUid -> { email, displayName } (events deliberately
// don't carry the owner's email, so it isn't visible to every member).
export default function ManagePage({ events, profiles, onCreate, onUpdate, onDelete, onOpen }) {
  const [filter, setFilter] = useState("pending"); // 'pending' | 'published' | 'declined' | 'all'
  const [editing, setEditing] = useState(null); // null | "new" | event

  if (events === null) return <div><PageHeader title="Manage Events" /><Empty text="Loading…" /></div>;

  const close = () => setEditing(null);
  const count = (s) => events.filter((e) => e.status === s).length;
  const collected = events.filter((e) => e.feePaid).reduce((s, e) => s + (Number(e.feeAmount) || 0), 0);
  const outstanding = events
    .filter((e) => !e.feePaid && e.status !== "declined")
    .reduce((s, e) => s + (Number(e.feeAmount) || 0), 0);

  const shown = events.filter((e) => filter === "all" || e.status === filter).sort(byStart);
  const ownerLabel = (ev) => {
    const p = profiles?.[ev.ownerUid];
    return p?.email || p?.displayName || "unknown promoter";
  };

  const save = async (fields, adminFields) => {
    const ok = editing === "new"
      ? await onCreate(fields, adminFields)
      : await onUpdate(editing.id, { ...fields, ...adminFields });
    if (ok) close();
    return ok;
  };

  const remove = (ev) => {
    if (window.confirm(`Delete "${ev.title}"? This can't be undone.`)) onDelete(ev.id);
  };

  return (
    <div>
      <PageHeader
        title="Manage Events"
        subtitle="Review submissions, listing fees and featured events"
        action={<button className="btn" onClick={() => setEditing("new")}><Plus size={14} /> Add event</button>}
      />

      <div className="stat-row">
        <Stat label="Pending review" value={count("pending")} tone="brass" />
        <Stat label="Live" value={count("published")} tone="bottle" />
        <Stat label="Fees collected" value={money(collected)} tone="bottle" />
        <Stat label="Fees outstanding" value={money(outstanding)} tone="rust" />
      </div>

      <div className="segmented" style={{ marginBottom: 18 }}>
        {[["pending", "Pending"], ["published", "Live"], ["declined", "Declined"], ["all", "All"]].map(([k, label]) => (
          <button key={k} className={"segment" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <Panel title={filter === "all" ? "All listings" : STATUS_LABEL[filter]}>
        {shown.length === 0 ? <Empty text="Nothing here." /> : shown.map((ev) => (
          <div key={ev.id} className="listing-row manage-row">
            <EventImage key={ev.imageUrl} url={ev.imageUrl} category={ev.category} className="listing-thumb" />
            <div className="listing-main">
              <div className="listing-title">
                {ev.title}
                {ev.featured && <Star size={13} fill="currentColor" className="listing-star" />}
              </div>
              <div className="listing-sub">{fmtEventWhen(ev)}</div>
              <div className="listing-sub">by {ownerLabel(ev)}</div>
              <div className="listing-chips">
                <span className={"status-chip listing-status-" + ev.status}>{STATUS_LABEL[ev.status] || ev.status}</span>
                <FeeControl event={ev} onUpdate={onUpdate} />
              </div>
            </div>
            <div className="listing-actions manage-actions">
              {ev.status !== "published" && (
                <button className="btn btn-small" onClick={() => onUpdate(ev.id, { status: "published" })}><Check size={12} /> Publish</button>
              )}
              {ev.status === "published" && (
                <button className="btn btn-ghost btn-small" onClick={() => onUpdate(ev.id, { status: "pending" })}>Unpublish</button>
              )}
              {ev.status !== "declined" && (
                <button className="btn btn-ghost btn-small" onClick={() => onUpdate(ev.id, { status: "declined" })}><X size={12} /> Decline</button>
              )}
              <button className="icon-btn" title={ev.featured ? "Remove from featured" : "Feature"} onClick={() => onUpdate(ev.id, { featured: !ev.featured })}>
                <Star size={15} fill={ev.featured ? "currentColor" : "none"} />
              </button>
              <button className="icon-btn" title="Preview" onClick={() => onOpen(ev)}><Eye size={15} /></button>
              <button className="icon-btn" title="Edit" onClick={() => setEditing(ev)}><Pencil size={15} /></button>
              <button className="icon-btn" title="Delete" onClick={() => remove(ev)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </Panel>

      {editing && (
        <Modal title={editing === "new" ? "Add event" : "Edit event"} onClose={close} wide>
          <EventForm
            adminMode
            initial={editing === "new" ? null : editing}
            submitLabel={editing === "new" ? "Add event" : "Save changes"}
            onSubmit={save}
            onCancel={close}
          />
        </Modal>
      )}
    </div>
  );
}

// Inline fee amount + paid toggle, so recording a payment is one click from
// the review queue (no need to open the full edit form).
function FeeControl({ event, onUpdate }) {
  const [amount, setAmount] = useState(String(event.feeAmount ?? 0));
  const commit = () => {
    const n = Math.max(0, Number(amount) || 0);
    setAmount(String(n));
    if (n !== (Number(event.feeAmount) || 0)) onUpdate(event.id, { feeAmount: n });
  };
  return (
    <span className="fee-control">
      <span className="fee-label">Fee $</span>
      <input
        className="input input-small fee-input"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={commit}
      />
      <label className="paid-toggle">
        <input type="checkbox" checked={!!event.feePaid} onChange={(e) => onUpdate(event.id, { feePaid: e.target.checked })} />
        <span className={"status-chip " + (event.feePaid ? "paid" : "unpaid")}>{event.feePaid ? "Paid" : "Unpaid"}</span>
      </label>
    </span>
  );
}
