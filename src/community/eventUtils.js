// Pure helpers for the Community module. No Firebase imports, so every page
// and component in src/community can share them freely.
import { PALETTE } from "../utils/constants";

export const EVENT_CATEGORIES = [
  "Nightlife", "Party", "Drag & Performance", "Community", "Fundraiser",
  "Arts & Culture", "Sports & Fitness", "Wellness", "Market", "Other",
];
export const AGE_OPTIONS = ["All ages", "18+", "21+"];

// pending = submitted, awaiting admin review; published = live in the
// community calendar; declined = reviewed and not listed (owner can edit and
// resubmit, which moves it back to pending).
export const STATUS_LABEL = { pending: "Pending review", published: "Live", declined: "Declined" };

// Shown on the promoter's "My Listings" page. Placeholder wording — edit to
// match however listing fees are actually arranged.
export const LISTING_NOTE =
  "New listings are reviewed before they appear in the community calendar. Listing fees for ticket sales are arranged with the community admin.";

export const categoryColor = (cat) => {
  const i = EVENT_CATEGORIES.indexOf(cat);
  return PALETTE[(i < 0 ? EVENT_CATEGORIES.length - 1 : i) % PALETTE.length];
};

/* ---- dates: events store plain "YYYY-MM-DD" / "HH:MM" strings ---- */

// Local-calendar ISO date. (utils/format's iso() goes through UTC, which can
// land on the wrong day for anyone east of Greenwich.)
export const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayLocal = () => localISO(new Date());
export const parseDay = (isoDate) => new Date(`${isoDate}T00:00:00`);

export const fmtDay = (isoDate) =>
  parseDay(isoDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function fmtEventWhen(ev) {
  const start = fmtDay(ev.date);
  if (ev.endDate && ev.endDate > ev.date) {
    const from = ev.startTime ? `${start} ${fmtTime(ev.startTime)}` : start;
    const to = ev.endTime ? `${fmtDay(ev.endDate)} ${fmtTime(ev.endTime)}` : fmtDay(ev.endDate);
    return `${from} – ${to}`;
  }
  const times = [fmtTime(ev.startTime), fmtTime(ev.endTime)].filter(Boolean).join(" – ");
  return times ? `${start} · ${times}` : start;
}

// Big month/day pair for the tile's date badge.
export function dateBadge(isoDate) {
  const d = parseDay(isoDate);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: d.getDate(),
  };
}

export const lastDay = (ev) => (ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date);
export const isPast = (ev, today = todayLocal()) => lastDay(ev) < today;

// Every calendar day an event touches (capped so a typo'd end date can't
// make the calendar enumerate years).
export function eventDays(ev) {
  const days = [];
  const end = lastDay(ev);
  const d = parseDay(ev.date);
  for (let i = 0; i < 31; i++) {
    const key = localISO(d);
    if (key > end) break;
    days.push(key);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export const byStart = (a, b) =>
  (a.date + (a.startTime || "")).localeCompare(b.date + (b.startTime || "")) || a.title.localeCompare(b.title);

/* ---- urls ---- */

// Promoters are untrusted, and these values end up in href/src attributes —
// only ever pass through plain http(s) URLs (never javascript:, data:, etc).
// A bare "example.com" is accepted and upgraded to https. Returns "" if the
// input isn't a usable web URL.
export function safeUrl(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

export const mapsUrl = (ev) => {
  const q = [ev.venueName, ev.address].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
};

/* ---- form <-> stored event ---- */

export const URL_FIELDS = ["imageUrl", "ticketUrl", "websiteUrl"];

export const blankEvent = () => ({
  title: "", category: "Community", date: "", endDate: "", startTime: "", endTime: "",
  venueName: "", address: "", description: "", imageUrl: "", ticketUrl: "", websiteUrl: "",
  price: "", ageRestriction: "All ages", organizerName: "", contactEmail: "",
});

// Returns an error message, or "" when the form is good to save.
export function validateEvent(f) {
  if (!f.title.trim()) return "Give the event a title.";
  if (!f.date) return "Pick the event's date.";
  if (f.endDate && f.endDate < f.date) return "The end date can't be before the start date.";
  for (const field of URL_FIELDS) {
    if (f[field].trim() && !safeUrl(f[field])) return "One of the links isn't a valid web address.";
  }
  if (f.contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(f.contactEmail.trim())) return "That contact email doesn't look right.";
  return "";
}

// Trim everything and normalize links, so what's stored is exactly what the
// Firestore rules expect (empty string or an http(s) URL).
export function cleanEventFields(f) {
  const out = {};
  for (const [k, v] of Object.entries(blankEvent())) {
    out[k] = typeof f[k] === "string" ? f[k].trim() : v;
  }
  for (const field of URL_FIELDS) out[field] = safeUrl(out[field]);
  if (!out.endDate || out.endDate === out.date) out.endDate = "";
  return out;
}
