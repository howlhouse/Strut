import { Clock, MapPin, Navigation, Ticket, Globe, Mail, UserRound } from "lucide-react";
import { Modal } from "../components/ui/Primitives";
import { EventImage } from "./EventTile";
import { categoryColor, fmtEventWhen, mapsUrl, safeUrl } from "./eventUtils";

// Full details for one event, opened from a tile or calendar chip. Every
// link is re-sanitized at render time (not just at save time) since the
// stored values were written by promoters.
export default function EventDetail({ event, onClose }) {
  const ticket = safeUrl(event.ticketUrl);
  const website = safeUrl(event.websiteUrl);
  const directions = mapsUrl(event);
  const email = /^\S+@\S+\.\S+$/.test(event.contactEmail || "") ? event.contactEmail : "";

  return (
    <Modal title={event.title} onClose={onClose} wide>
      <EventImage key={event.imageUrl} url={event.imageUrl} category={event.category} className="event-detail-img" />

      <div className="event-detail-chips">
        <span className="pill" style={{ background: categoryColor(event.category) }}>{event.category}</span>
        {event.ageRestriction && <span className="tag tag-credit">{event.ageRestriction}</span>}
        {event.price && <span className="tag tag-debit">{event.price}</span>}
      </div>

      <div className="event-detail-rows">
        <div className="event-detail-row"><Clock size={15} /><span>{fmtEventWhen(event)}</span></div>
        {(event.venueName || event.address) && (
          <div className="event-detail-row">
            <MapPin size={15} />
            <span>
              {event.venueName && <strong>{event.venueName}</strong>}
              {event.venueName && event.address && <br />}
              {event.address}
            </span>
          </div>
        )}
        {event.organizerName && <div className="event-detail-row"><UserRound size={15} /><span>Presented by {event.organizerName}</span></div>}
      </div>

      {event.description && <p className="event-detail-desc">{event.description}</p>}

      <div className="event-detail-actions">
        {ticket && (
          <a className="btn" href={ticket} target="_blank" rel="noopener noreferrer"><Ticket size={14} /> Get tickets</a>
        )}
        {directions && (
          <a className="btn btn-ghost" href={directions} target="_blank" rel="noopener noreferrer"><Navigation size={14} /> Directions</a>
        )}
        {website && (
          <a className="btn btn-ghost" href={website} target="_blank" rel="noopener noreferrer"><Globe size={14} /> Website</a>
        )}
        {email && (
          <a className="btn btn-ghost" href={`mailto:${email}`}><Mail size={14} /> Contact</a>
        )}
      </div>
    </Modal>
  );
}
