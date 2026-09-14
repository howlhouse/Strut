# Align

A personal finance tracker — bills, cards, festival/layaway installment plans,
bank accounts, cash-flow forecasting, and spending analytics. Built with React
and Vite, deployed for free on GitHub Pages.

**Live app:** https://howlhouse.github.io/Align/

## Stack

- **React + Vite** — no server, just a static build.
- **recharts** — forecast and analytics charts.
- **lucide-react** — icons.
- **GitHub Pages** — free static hosting, deployed automatically via GitHub
  Actions on every push to `main` (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## Data & persistence

Data is currently stored in the browser's `localStorage` (see
[`src/storage.js`](src/storage.js)) — everything you enter stays on your
device, works offline, and costs nothing. The `storage.get`/`storage.set`
interface is intentionally small so it can be swapped for a Firebase
Firestore-backed implementation later (for cross-device sync) without
touching the rest of the app.

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
