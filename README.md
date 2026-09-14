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

Signing in with Google (see [`src/AuthGate.jsx`](src/AuthGate.jsx)) scopes all
of your data to your own Firestore document at `users/{your-uid}/strut/data`
(see [`src/storage.js`](src/storage.js)). [`firestore.rules`](firestore.rules)
restricts reads/writes to that same uid — nobody else can read or overwrite
your data, even though the Firebase config shipped in the app is public (it's
a client identifier, not a secret; the rules are what enforce access).
Firestore's persistent local cache keeps the app usable offline, syncing once
you're back online.

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
