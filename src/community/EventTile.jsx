import { useState } from "react";
import { CalendarDays, MapPin, Ticket, Star } from "lucide-react";
import { categoryColor, dateBadge, fmtEventWhen, safeUrl } from "./eventUtils";

// Event image with a graceful fallback: a bad/blocked/missing image URL
// shows a category-colored gradient instead of a broken-image icon. Keyed on
// the URL by callers so a changed URL gets a fresh load attempt.
export function EventImage({ url, category, className }) {
  const [failed, setFailed] = useState(false);
  const src = safeUrl(url);
  if (!src || failed) {
    return (
      <div className={className + " event-img-fallback"} style={{ background: `linear-gradient(135deg, ${categoryColor(category)}, var(--surface-2))` }}>
        <CalendarDays size={30} strokeWidth={1.5} />
      </div>
    );
  }
  return <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

// One event on the main screen. `large` is used for the featured strip.
export default function EventTile({ event, onOpen, large }) {
  const badge = dateBadge(event.date);
  const color = categoryColor(event.category);
  const open = () => onOpen(event);
  return (
    <div
      className={"event-tile" + (large ? " large" : "")}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
    >
      <div className="event-tile-media">
        <EventImage key={event.imageUrl} url={event.imageUrl} category={event.category} className="event-tile-img" />
        <div className="event-date-badge">
          <span className="event-date-month">{badge.month}</span>
          <span className="event-date-day">{badge.day}</span>
        </div>
        {event.featured && <span className="event-featured-flag"><Star size={11} fill="currentColor" /> Featured</span>}
      </div>
      <div className="event-tile-body">
        <span className="pill" style={{ background: color }}>{event.category}</span>
        <h3 className="event-tile-title">{event.title}</h3>
        <div className="event-tile-meta">{fmtEventWhen(event)}</div>
        {(event.venueName || event.address) && (
          <div className="event-tile-meta"><MapPin size={12} /> {event.venueName || event.address}</div>
        )}
        <div className="event-tile-foot">
          <span className="event-tile-price">{event.price || ""}</span>
          {safeUrl(event.ticketUrl) && <span className="event-tile-tickets"><Ticket size={12} /> Tickets</span>}
        </div>
      </div>
    </div>
  );
}
