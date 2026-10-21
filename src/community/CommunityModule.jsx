import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listUserProfiles } from "../adminData.js";
import {
  createEvent, updateEvent, removeEvent,
  subscribePublishedEvents, subscribeOwnEvents, subscribeAllEvents,
} from "./events.js";
import EventDetail from "./EventDetail";
import EventsPage from "./pages/EventsPage";
import CalendarPage from "./pages/CalendarPage";
import MyListingsPage from "./pages/MyListingsPage";
import ManagePage from "./pages/ManagePage";

// Owns the Community module's live data and renders whichever of its pages
// the sidebar has selected. Events are separate Firestore docs shared between
// users, so each page gets small action props that write straight to them.
// (null = still loading, [] = loaded and empty.)
export default function CommunityModule({ tab, currentUser, isAdmin }) {
  const [published, setPublished] = useState(null);
  const [mine, setMine] = useState(null);
  const [all, setAll] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const fail = () => {
      setLoadFailed(true);
      setError("Couldn't load events. Check your connection, or that the latest Firestore rules are published.");
    };
    const unsubs = [
      subscribePublishedEvents(setPublished, fail),
      subscribeOwnEvents(currentUser.uid, setMine, fail),
    ];
    if (isAdmin) {
      unsubs.push(subscribeAllEvents(setAll, fail));
      listUserProfiles()
        .then((list) => setProfiles(Object.fromEntries(list.map((p) => [p.uid, p]))))
        .catch(() => {});
    }
    return () => unsubs.forEach((u) => u());
  }, [currentUser.uid, isAdmin]);

  // Run a write and resolve to whether it worked, surfacing a failure
  // instead of silently dropping it. (Never rejects, so inline buttons that
  // ignore the result can't cause unhandled rejections; forms check it to
  // decide whether to close.)
  const guard = (fn) => async (...args) => {
    setError("");
    try { await fn(...args); return true; } catch { setError("That change didn't save. Try again."); return false; }
  };
  const onCreate = guard((fields, adminFields) => createEvent(fields, currentUser.uid, adminFields || {}));
  const onUpdate = guard(updateEvent);
  const onDelete = guard((id) => removeEvent(id));

  // The detail modal looks the event up by id so it reflects live edits
  // (e.g. an admin unpublishing it while someone has it open).
  const openEvent = openId && [...(all || []), ...(mine || []), ...(published || [])].find((e) => e.id === openId);
  const onOpen = (ev) => setOpenId(ev.id);

  // If the feed itself couldn't load, the banner is the whole story — don't
  // leave pages sitting on "Loading…" forever.
  const ready = !(loadFailed && published === null);

  return (
    <div>
      {error && (
        <div className="form-error banner-error">
          <span>{error}</span>
          <button className="icon-btn" onClick={() => setError("")} title="Dismiss"><X size={14} /></button>
        </div>
      )}

      {ready && tab === "events" && <EventsPage events={published} onOpen={onOpen} />}
      {ready && tab === "calendar" && <CalendarPage events={published} onOpen={onOpen} />}
      {ready && tab === "my-events" && (
        <MyListingsPage events={mine} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} onOpen={onOpen} />
      )}
      {ready && tab === "manage" && isAdmin && (
        <ManagePage events={all} profiles={profiles} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} onOpen={onOpen} />
      )}

      {openEvent && <EventDetail event={openEvent} onClose={() => setOpenId(null)} />}
    </div>
  );
}
