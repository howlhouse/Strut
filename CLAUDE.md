# Strut

A community events platform: a shared events calendar where promoters post
events — image tiles, address, ticket link — and admins review, publish and
feature them. Includes an admin console for user access and a shared
tag/category catalog. (The earlier personal-finance version of the app lives
at the `finance-app-final` git tag.)

## Stack

- React 19 + Vite, no router (single-page tab switcher in [src/App.jsx](src/App.jsx))
- Firebase Auth (Google sign-in only) + Firestore for persistence
- `lucide-react` for icons
- Deployed via GitHub Actions to GitHub Pages (see `.github/workflows`)

Run `npm run dev` for the dev server, `npm run build` to build.

## Structure

```
src/
  main.jsx           entry point, mounts AuthGate
  AuthGate.jsx        Google sign-in gate; resolves admin status; renders App
  firebase.js         Firebase app/auth/db init
  catalog.js          Firestore-backed shared tag/category catalog (one doc, admin-writable)
  adminData.js        Firestore-backed user profiles + admin-access flags
  useTheme.js         light/dark/system theme hook
  theme.css           all styling (CSS variables + component classes)
  assets/             logo mark + wordmark SVGs

  App.jsx             nav/routing shell + catalog state/actions for the Admin Console
  utils/              format.js, months.js, constants.js (PALETTE)
  components/ui/Primitives.jsx   shared Modal, PageHeader, Panel, Field, Empty, Pill, ...
  pages/              SettingsPage (theme), AdminPage (Users + Tags & Categories)

  community/            the events module
    CommunityModule.jsx  owns the live Firestore subscriptions, renders the active page
    events.js            Firestore layer for the communityEvents collection
    eventUtils.js        pure helpers: dates, categories, safeUrl(), form validation
    EventTile/EventDetail/EventForm.jsx   shared tile, detail modal, add/edit form
    pages/               EventsPage (tile grid), CalendarPage, MyListingsPage
                         (promoter), ManagePage (admin: review, fees, featured)
```

## Data model

Events are individual docs
in a top-level `communityEvents/{id}` collection (see
[src/community/events.js](src/community/events.js)), shared across users:

- Any signed-in user can submit a listing; it starts `status: "pending"`,
  `feePaid: false`, `featured: false` — the rules in `firestore.rules` force
  that for non-admins. An admin publishes it (`status: "published"`), records
  the listing fee (`feeAmount`/`feePaid` — tracked manually, no payment
  processor), and may feature it.
- Visibility: `published` events are readable by every signed-in user;
  pending/declined only by the owner (`ownerUid`) and admins. Queries must
  match the rules (published feed, own listings, or all-for-admin).
- Owner email is deliberately **not** stored on the event; admins resolve
  `ownerUid` through `userProfiles`.
- All link fields (`imageUrl`, `ticketUrl`, `websiteUrl`) must be http(s) —
  enforced in the rules and by `safeUrl()`; use `safeUrl()` for any new href/src.
- `firestore.rules` is **not** deployed by CI (Pages only builds the site) —
  rule changes must be published in the Firebase console or via the CLI.

The shared tag/category **catalog** (`{ categories: [], tags: [] }`) is a
separate Firestore doc (`catalog/shared`, see [src/catalog.js](src/catalog.js)),
readable by every signed-in user but writable only by an admin.

The shared tag/category **catalog** (`{ categories: [], tags: [] }`) is a
separate Firestore doc (`catalog/shared`, see [src/catalog.js](src/catalog.js)),
readable by every signed-in user but writable only by an admin.

## Conventions

- No TypeScript, no CSS modules — plain `.jsx` and one global `theme.css` using
  CSS custom properties.
- No test suite currently exists.
- Admin-owner status is tied to a single owner email in `AuthGate.jsx` and
  `firestore.rules`.
- Legacy: per-user finance documents (`users/{uid}/...`) from the old finance
  app may still exist in Firestore. The app no longer reads them.
