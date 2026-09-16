import { useState, useEffect } from "react";
import { Plus, X, Check, Pencil, Trash2 } from "lucide-react";
import { fmtDateLong } from "../utils/format";
import { PALETTE } from "../utils/constants";
import { listUserProfiles, listAdminUids, setAdminAccess } from "../adminData.js";
import { PageHeader, Panel, Empty, Pill, ColorSwatchPicker } from "../components/ui/Primitives";

export default function AdminPage({ catalog, addCategory, updateCategoryEntry, deleteCategoryEntry, addTag, updateTagEntry, deleteTagEntry, isOwner, currentUser }) {
  const [section, setSection] = useState("users"); // 'users' | 'catalog'

  return (
    <div>
      <PageHeader title="Admin Console" subtitle="Account access and the shared tag/category catalog" />
      <div className="segmented" style={{ marginBottom: 18 }}>
        <button className={"segment" + (section === "users" ? " active" : "")} onClick={() => setSection("users")}>Users</button>
        <button className={"segment" + (section === "catalog" ? " active" : "")} onClick={() => setSection("catalog")}>Tags & Categories</button>
      </div>

      {section === "users" ? (
        <AdminUsersSection isOwner={isOwner} currentUser={currentUser} />
      ) : (
        <AdminCatalogSection
          catalog={catalog}
          addCategory={addCategory}
          updateCategoryEntry={updateCategoryEntry}
          deleteCategoryEntry={deleteCategoryEntry}
          addTag={addTag}
          updateTagEntry={updateTagEntry}
          deleteTagEntry={deleteTagEntry}
        />
      )}
    </div>
  );
}

function AdminUsersSection({ isOwner, currentUser }) {
  const [profiles, setProfiles] = useState(null); // null = loading
  const [adminUids, setAdminUids] = useState([]);
  const [error, setError] = useState("");

  const reload = () => {
    Promise.all([listUserProfiles(), listAdminUids()])
      .then(([p, a]) => { setProfiles(p); setAdminUids(a); })
      .catch(() => setError("Couldn't load users."));
  };

  useEffect(reload, []);

  const toggleAdmin = (profile) => {
    const next = !adminUids.includes(profile.uid);
    setAdminUids((prev) => (next ? [...prev, profile.uid] : prev.filter((id) => id !== profile.uid)));
    setAdminAccess(profile.uid, next, profile.email).catch(() => { setError("Couldn't update admin access."); reload(); });
  };

  const fmtTimestamp = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(d) ? "—" : fmtDateLong(d);
  };

  return (
    <Panel title="Users">
      {error && <p className="hint" style={{ color: "var(--rust)" }}>{error}</p>}
      {profiles === null ? (
        <p className="empty">Loading…</p>
      ) : profiles.length === 0 ? (
        <Empty text="No user accounts found yet." />
      ) : (
        <div className="ledger">
          {profiles.map((p) => {
            const isThisOwner = p.email === "howlhousemedia@gmail.com";
            const isAdminUser = isThisOwner || adminUids.includes(p.uid);
            return (
              <div className="ledger-row wrap" key={p.uid}>
                <span className="dot" style={{ background: isAdminUser ? "var(--brand)" : "var(--line)" }} />
                <span className="col-name">
                  {p.displayName || p.email}
                  {isThisOwner && <span className="tag tag-credit">Owner</span>}
                  {p.uid === currentUser?.uid && <span className="tag tag-debit">You</span>}
                </span>
                <span className="col-card" style={{ width: 200 }}>{p.email}</span>
                <span className="col-date" style={{ width: 110 }}>joined {fmtTimestamp(p.createdAt)}</span>
                <span className="col-date" style={{ width: 110 }}>active {fmtTimestamp(p.lastLoginAt)}</span>
                <label className="paid-toggle" title={isOwner ? "Grant or revoke admin access" : "Only the account owner can change admin access"}>
                  <input type="checkbox" checked={isAdminUser} disabled={!isOwner || isThisOwner} onChange={() => toggleAdmin(p)} />
                  <span className={isAdminUser ? "tag tag-paid" : "tag tag-unpaid"}>{isAdminUser ? "Admin" : "No admin access"}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
      {!isOwner && <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>Only the account owner can grant or revoke admin access.</p>}
    </Panel>
  );
}

function AdminCatalogSection({ catalog, addCategory, updateCategoryEntry, deleteCategoryEntry, addTag, updateTagEntry, deleteTagEntry }) {
  return (
    <>
      <CatalogEditor title="Categories" items={catalog.categories} onAdd={addCategory} onUpdate={updateCategoryEntry} onDelete={deleteCategoryEntry} addLabel="Add category" />
      <CatalogEditor title="Tags" items={catalog.tags} onAdd={addTag} onUpdate={updateTagEntry} onDelete={deleteTagEntry} addLabel="Add tag" />
    </>
  );
}

function CatalogEditor({ title, items, onAdd, onUpdate, onDelete, addLabel }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const submitAdd = (e) => {
    e.preventDefault();
    if (!newName) return;
    onAdd({ name: newName, color: newColor });
    setNewName(""); setNewColor(PALETTE[0]); setAdding(false);
  };

  return (
    <Panel title={title} right={
      <button className="btn btn-ghost btn-small" onClick={() => setAdding((v) => !v)}>
        {adding ? <X size={13} /> : <Plus size={13} />} {adding ? "Close" : addLabel}
      </button>
    }>
      {adding && (
        <form className="add-row-form" style={{ flexWrap: "wrap" }} onSubmit={submitAdd}>
          <input className="input input-small" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" autoFocus />
          <ColorSwatchPicker value={newColor} onChange={setNewColor} />
          <button className="btn btn-primary btn-small" type="submit"><Plus size={13} /> Add</button>
        </form>
      )}
      {items.length === 0 ? (
        <Empty text={`No ${title.toLowerCase()} yet.`} />
      ) : (
        <div className="ledger">
          {items.map((item) => (
            <CatalogItemRow key={item.id} item={item} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function CatalogItemRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [colorDraft, setColorDraft] = useState(item.color);

  const save = () => {
    onUpdate(item.id, { name: nameDraft, color: colorDraft });
    setEditing(false);
  };

  return (
    <div className="ledger-row wrap">
      <span className="dot" style={{ background: item.color }} />
      {editing ? (
        <div className="paid-summary" style={{ flex: 1 }}>
          <input className="input input-small" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          <ColorSwatchPicker value={colorDraft} onChange={setColorDraft} />
          <button type="button" className="icon-btn" onClick={save} title="Save"><Check size={14} /></button>
          <button type="button" className="icon-btn" onClick={() => setEditing(false)} title="Cancel"><X size={14} /></button>
        </div>
      ) : (
        <>
          <span className="col-name"><Pill item={item} /></span>
          <button type="button" className="icon-btn" onClick={() => { setNameDraft(item.name); setColorDraft(item.color); setEditing(true); }} title="Edit"><Pencil size={13} /></button>
        </>
      )}
      <button className="icon-btn" onClick={() => onDelete(item.id)} title="Delete"><Trash2 size={14} /></button>
    </div>
  );
}
