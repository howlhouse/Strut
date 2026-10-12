import { useState } from "react";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { PageHeader, Panel, Empty, Modal } from "../../components/ui/Primitives";
import { money } from "../../utils/format";
import { EventImage } from "../EventTile";
import EventForm from "../EventForm";
import { LISTING_NOTE, STATUS_LABEL, byStart, fmtEventWhen } from "../eventUtils";

// A promoter's own listings: post a new event, edit or remove existing ones,
// and see where each one stands in review.
export default function MyListingsPage({ events, onCreate, onUpdate, onDelete, onOpen }) {
  const [editing, setEditing] = useState(null); // null | "new" | event

  const close = () => setEditing(null);
  const list = [...(events || [])].sort((a, b) => byStart(b, a));

  const save = async (fields) => {
    const ok = editing === "new"
      ? await onCreate(fields)
      // A declined listing that's been edited goes back into the review queue.
      : await onUpdate(editing.id, editing.status === "declined" ? { ...fields, status: "pending" } : fields);
    if (ok) close();
    return ok;
  };

  const remove = (ev) => {
    if (window.confirm(`Delete "${ev.title}"? This can't be undone.`)) onDelete(ev.id);
  };

  return (
    <div>
      <PageHeader
        title="My Listings"
        subtitle="Events you've posted to the community calendar"
        action={<button className="btn" onClick={() => setEditing("new")}><Plus size={14} /> Post an event</button>}
      />
      <p className="page-footnote">{LISTING_NOTE}</p>

      <Panel title="Your events">
        {events === null ? <Empty text="Loading…" /> : list.length === 0 ? (
          <Empty text="You haven't posted anything yet. Use “Post an event” to submit your first listing." />
        ) : (
          list.map((ev) => (
            <div key={ev.id} className="listing-row">
              <EventImage key={ev.imageUrl} url={ev.imageUrl} category={ev.category} className="listing-thumb" />
              <div className="listing-main">
                <div className="listing-title">{ev.title}</div>
                <div className="listing-sub">{fmtEventWhen(ev)}</div>
                <div className="listing-chips">
                  <span className={"status-chip listing-status-" + ev.status}>{STATUS_LABEL[ev.status] || ev.status}</span>
                  {ev.feeAmount > 0 && (
                    <span className={"status-chip " + (ev.feePaid ? "paid" : "unpaid")}>
                      {ev.feePaid ? "Fee paid" : `Fee due ${money(ev.feeAmount)}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="listing-actions">
                {ev.status === "published" && <button className="icon-btn" title="View" onClick={() => onOpen(ev)}><Eye size={15} /></button>}
                <button className="icon-btn" title="Edit" onClick={() => setEditing(ev)}><Pencil size={15} /></button>
                <button className="icon-btn" title="Delete" onClick={() => remove(ev)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))
        )}
      </Panel>

      {editing && (
        <Modal title={editing === "new" ? "Post an event" : "Edit event"} onClose={close} wide>
          <EventForm
            initial={editing === "new" ? null : editing}
            submitLabel={editing === "new" ? "Submit for review" : editing.status === "declined" ? "Resubmit for review" : "Save changes"}
            onSubmit={save}
            onCancel={close}
          />
        </Modal>
      )}
    </div>
  );
}
