import { useMemo, useState } from "react";
import { PageHeader, Empty, MonthSwitcher } from "../../components/ui/Primitives";
import { startOfMonth } from "../../utils/months";
import { daysInMonth } from "../../utils/format";
import EventTile from "../EventTile";
import { byStart, categoryColor, eventDays, fmtDay, localISO, todayLocal } from "../eventUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 2;

// Month grid of everything that's live. Clicking a day lists that day's
// events underneath; with no day selected it lists the whole month.
export default function CalendarPage({ events, onOpen }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(null);

  const byDay = useMemo(() => {
    const map = {};
    for (const ev of events || []) for (const day of eventDays(ev)) (map[day] = map[day] || []).push(ev);
    for (const list of Object.values(map)) list.sort(byStart);
    return map;
  }, [events]);

  const year = month.getFullYear();
  const m = month.getMonth();
  const prefix = localISO(month).slice(0, 7);
  const today = todayLocal();
  const cells = [
    ...Array(month.getDay()).fill(null),
    ...Array.from({ length: daysInMonth(year, m) }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`),
  ];

  const monthEvents = Object.entries(byDay)
    .filter(([day]) => day.startsWith(prefix))
    .flatMap(([, list]) => list)
    .filter((ev, i, all) => all.indexOf(ev) === i)
    .sort(byStart);
  const listed = selected ? byDay[selected] || [] : monthEvents;

  const changeMonth = (next) => { setMonth(next); setSelected(null); };

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Every live event, by day" />
      <MonthSwitcher month={month} setMonth={changeMonth} />

      <section className="panel">
        <div className="cal-grid cal-head">
          {WEEKDAYS.map((d) => <div key={d} className="cal-weekday">{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="cal-cell cal-pad" />;
            const list = byDay[day] || [];
            return (
              <div
                key={day}
                className={"cal-cell" + (day === today ? " today" : "") + (day === selected ? " selected" : "") + (list.length ? " has-events" : "")}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(day === selected ? null : day)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(day === selected ? null : day); } }}
              >
                <span className="cal-daynum">{Number(day.slice(8))}</span>
                {list.slice(0, MAX_CHIPS).map((ev) => (
                  <button
                    key={ev.id}
                    className="cal-chip"
                    style={{ background: categoryColor(ev.category) }}
                    title={ev.title}
                    onClick={(e) => { e.stopPropagation(); onOpen(ev); }}
                  >
                    {ev.title}
                  </button>
                ))}
                {list.length > MAX_CHIPS && <span className="cal-more">+{list.length - MAX_CHIPS} more</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="event-section">
        <h2 className="event-section-title">{selected ? fmtDay(selected) : "This month"}</h2>
        {listed.length === 0 ? (
          <Empty text={selected ? "Nothing scheduled for this day." : "No events this month."} />
        ) : (
          <div className="event-grid">
            {listed.map((ev) => <EventTile key={ev.id} event={ev} onOpen={onOpen} />)}
          </div>
        )}
      </section>
    </div>
  );
}
