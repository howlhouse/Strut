import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, Empty } from "../../components/ui/Primitives";
import EventTile from "../EventTile";
import { EVENT_CATEGORIES, byStart, isPast } from "../eventUtils";

// The community's main screen: a tile grid of everything that's live,
// upcoming first, with a featured strip on top when nothing is filtered.
export default function EventsPage({ events, onOpen }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [when, setWhen] = useState("upcoming"); // 'upcoming' | 'past'

  if (events === null) return <div><PageHeader title="Community Events" subtitle="What's happening in our community" /><Empty text="Loading events…" /></div>;

  const q = query.trim().toLowerCase();
  const matches = (ev) =>
    (category === "all" || ev.category === category) &&
    (!q || [ev.title, ev.venueName, ev.address, ev.organizerName, ev.description].some((s) => (s || "").toLowerCase().includes(q)));

  const upcoming = events.filter((ev) => !isPast(ev)).sort(byStart);
  const past = events.filter(isPast).sort((a, b) => byStart(b, a));
  const shown = (when === "upcoming" ? upcoming : past).filter(matches);
  const featured = upcoming.filter((ev) => ev.featured);
  const showFeatured = when === "upcoming" && !q && category === "all" && featured.length > 0;
  // With the featured strip showing, don't repeat those events in the grid.
  const rest = showFeatured ? shown.filter((ev) => !ev.featured) : shown;

  return (
    <div>
      <PageHeader title="Community Events" subtitle="What's happening in our community" />

      <div className="event-toolbar">
        <div className="event-search">
          <Search size={14} />
          <input className="input" placeholder="Search events, venues, promoters…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="segmented">
          <button className={"segment" + (when === "upcoming" ? " active" : "")} onClick={() => setWhen("upcoming")}>Upcoming</button>
          <button className={"segment" + (when === "past" ? " active" : "")} onClick={() => setWhen("past")}>Past</button>
        </div>
      </div>

      {showFeatured && (
        <section className="event-section">
          <h2 className="event-section-title">Featured</h2>
          <div className="event-grid event-grid-featured">
            {featured.map((ev) => <EventTile key={ev.id} event={ev} onOpen={onOpen} large />)}
          </div>
        </section>
      )}

      {(rest.length > 0 || !showFeatured) && (
        <section className="event-section">
          {showFeatured && <h2 className="event-section-title">More events</h2>}
          {rest.length === 0 ? (
            <Empty text={events.length === 0 ? "No events have been posted yet — check back soon." : "No events match those filters."} />
          ) : (
            <div className="event-grid">
              {rest.map((ev) => <EventTile key={ev.id} event={ev} onOpen={onOpen} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
