# Strut

A personal finance tracker — bills, cards, festival/layaway installment plans,
bank accounts, cash-flow forecasting, and spending analytics. Built with React
and Vite, deployed for free on GitHub Pages, synced across devices via
Firebase.

**Live app:** https://howlhouse.github.io/Strut/

## Stack

- **React + Vite** — no server, just a static build.
- **recharts** — forecast and analytics charts.
- **lucide-react** — icons.
- **Firebase Auth (Google Sign-In) + Firestore** — sign-in and cross-device
  data sync.
- **GitHub Pages** — free static hosting, deployed automatically via GitHub
  Actions on every push to `main` (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## Auth & data

Signing in with Google (see [`src/AuthGate.jsx`](src/AuthGate.jsx)) is open to
any Google account, but [`firestore.rules`](firestore.rules) hard-locks all
reads/writes to one specific owner Firebase UID — every other account gets
zero access, not just a sandboxed empty account. Data lives in a single
Firestore document at `users/{owner-uid}/strut/data` (see
[`src/storage.js`](src/storage.js)). Firestore's persistent local cache keeps
the app usable offline, syncing once you're back online.

The Firebase config in [`src/firebase.js`](src/firebase.js) (including the
API key) is a public client identifier, not a secret — Firebase documents
this explicitly, and GitHub's secret-scanning alert for it was closed as a
false positive. Access control is entirely enforced by `firestore.rules`
above, not by hiding this config.

As defense in depth (prevents others from reusing the key, though it grants
no data access either way), the API key is also restricted in Google Cloud
Console (APIs & Services → Credentials → Application restrictions →
Websites) to these HTTP referrers — **all three are required**, since Google
Sign-In's popup/redirect flow proxies through the Firebase auth handler
domain before reaching Google:

- `https://howlhouse.github.io/*`
- `https://strut-for-me.firebaseapp.com/*` (Firebase's own auth handler — sign-in fails without this one)
- `http://localhost:5173/*` (local dev)

Firebase project: `strut-for-me`.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs to `dist/`, which is what the GitHub Actions workflow deploys to
Pages.

## Deploying Firestore rule changes

Editing [`firestore.rules`](firestore.rules) doesn't take effect until
deployed:

```bash
npx firebase-tools deploy --only firestore:rules --project strut-for-me
```
