<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/strut-wordmark-dark.svg">
    <img src="src/assets/strut-wordmark-light.svg" alt="Strut" height="70">
  </picture>
</p>

A community events platform: a shared events calendar where promoters list
events (image tiles, address, ticket link) and admins review, publish and
feature them. Built with React and Vite, deployed for free on GitHub Pages,
backed by Firebase.

> The original personal-finance version of this app is preserved at the
> `finance-app-final` git tag.

**Live app:** https://howlhouse.github.io/Strut/

## Stack

- **React + Vite** — no server, just a static build.
- **lucide-react** — icons.
- **Firebase Auth (Google Sign-In) + Firestore** — sign-in and event data.
- **GitHub Pages** — free static hosting, deployed automatically via GitHub
  Actions on every push to `main` (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## Auth & data

Anyone can sign in with Google (see [`src/AuthGate.jsx`](src/AuthGate.jsx)).
Signed-in users browse published events and can submit their own listings;
admins review, publish, feature and manage everything. Events live in the
`communityEvents` Firestore collection, and [`firestore.rules`](firestore.rules)
enforces who can read and change what: promoters can only create *pending*
listings and can never touch the admin-controlled fields (status, fee,
featured, owner), and links must be plain http(s).

The Firebase config in [`src/firebase.js`](src/firebase.js) (including the
API key) is a public client identifier, not a secret — Firebase documents
this explicitly. Access control is enforced entirely by `firestore.rules`, not
by hiding this config.

As defense in depth, the API key is also restricted in Google Cloud Console
(APIs & Services → Credentials → Application restrictions → Websites) to these
HTTP referrers — **all three are required**, since Google Sign-In's
popup/redirect flow proxies through the Firebase auth handler domain:

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
