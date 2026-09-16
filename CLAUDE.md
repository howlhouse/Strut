# Strut

A personal finance tracker: bills, credit/debit card ledgers, bank accounts with
their own transaction ledger, layaway/installment plans, cash-flow forecasting,
budgets by category, spending analytics, and an admin console for a shared
tag/category catalog and user access.

## Stack

- React 19 + Vite, no router (single-page tab switcher in [src/App.jsx](src/App.jsx))
- Firebase Auth (Google sign-in only) + Firestore for persistence
- `recharts` for charts, `lucide-react` for icons
- Deployed via GitHub Actions to Firebase Hosting (see `.github/workflows`)

Run `npm run dev` for the dev server, `npm run build` to build.

## Structure

```
src/
  main.jsx           entry point, mounts AuthGate
  AuthGate.jsx        Google sign-in gate; resolves admin status; renders App
  firebase.js         Firebase app/auth/db init
  storage.js          Firestore-backed get/set, scoped to the signed-in uid
  catalog.js          Firestore-backed shared tag/category catalog (one doc, admin-writable)
  adminData.js        Firestore-backed user profiles + admin-access flags
  useTheme.js         light/dark/system theme hook
  theme.css           all styling (CSS variables + component classes)
  assets/             logo mark + wordmark SVGs

  App.jsx             top-level state, all data-mutating actions, nav/routing shell
                      (no page-specific UI — see pages/)

  utils/
    format.js          money/date formatting, uid generation, pct helpers
    months.js          month navigation helpers + isBillRelevantForMonth
    constants.js        DEFAULT_DATA, CARD_COLORS, PALETTE (tag/category swatches)
    funding.js         unifies cards + bank accounts as payment sources
                       (fundingSource, isBankAccountId, accountBalance, signedAmount)
    bills.js           billDueInfo, billHistoryEntries, scheduled-amount helpers
    analytics.js        monthlyBillTotals, cardMonthlySpend, seriesStats
    forecast.js         computeForecast (per-card) and computeCashForecast (per-account)
    netMoney.js         totalBankBalances/totalCardBalancesOwed/netMoneyNow, budgets math
    demoData.js         buildDemoData() for the "Load demo data" button

  components/ui/
    Primitives.jsx      shared pieces: Modal, PageHeader, Panel, Field, Stat, Empty,
                       Pill, ColorSwatchPicker, FundingSourceSelect, MonthSwitcher

  pages/                one file per sidebar tab; each default-exports the page
                      and keeps its row/form subcomponents local to that file
    Dashboard.jsx        also exports nothing else; imports BillRow from BillsPage
                       for the "browsing a past/future month" view
    BillsPage.jsx        exports BillRow (named) since Dashboard reuses it
    BudgetsPage.jsx
    LayawayPage.jsx
    CardsPage.jsx
    BankAccountsPage.jsx  accounts have their own transaction ledger (accountTransactions)
    ForecastPage.jsx
    AnalyticsPage.jsx
    SettingsPage.jsx
    AdminPage.jsx        Users tab (adminData.js) + Tags & Categories tab (catalog.js)
```

**Finding things**: a page's own subcomponents (rows, add-forms) live at the
bottom of that page's file — e.g. `AddBillForm` is in
[src/pages/BillsPage.jsx](src/pages/BillsPage.jsx). The one cross-page
exception is `BillRow`, exported from `BillsPage.jsx` and reused by
`Dashboard.jsx` when browsing a non-current month. Cross-page shared logic
goes in `utils/`; cross-page shared UI goes in `components/ui/Primitives.jsx`.

## Data model

Everything lives in one JSON blob (shape defined by `DEFAULT_DATA` in
[src/utils/constants.js](src/utils/constants.js)), saved as a single Firestore
document per user (`users/{uid}/strut/data`, see [src/storage.js](src/storage.js)):

- `cards` — credit or debit cards, each with a starting balance/date
- `bills` — recurring (monthly, by `dueDay`) or one-time (`dueDate`); can carry
  a `categoryId`, `tagIds[]`, and `scheduledAmounts` (preloaded future-cycle amounts)
- `billPayments` — keyed by month (`YYYY-MM`, or `once-<billId>`) → billId → payment record
- `layaways` — installment plans ("festivals"), each with an `installments[]` array
- `cardTransactions` — ledger for `cards`; every paid bill/installment auto-creates one
- `bankAccounts` — checking/savings accounts, each reconciled via `balance`/`updatedDate`
- `accountTransactions` — ledger for `bankAccounts`, mirrors `cardTransactions`
- `budgets` — one per category, `{ categoryId, monthlyAmount }`
- `incomes` — recurring paychecks, used only by the cash Forecast page
- `settings` — dashboard reminder prefs

A bill or transaction can be funded by *either* a card or a bank account — see
`fundingSource`/`isBankAccountId` in [src/utils/funding.js](src/utils/funding.js),
which resolve a single id across both collections.

The shared tag/category **catalog** (`{ categories: [], tags: [] }`) is a
separate Firestore doc (`catalog/shared`, see [src/catalog.js](src/catalog.js)),
readable by every signed-in user but writable only by an admin.

All data mutations go through `update(fn)` in `App.jsx`, which deep-clones
state via `structuredClone` before mutating — pages never call `setData`
directly, they call action props passed down from `App.jsx`.

## Conventions

- No TypeScript, no CSS modules — plain `.jsx` and one global `theme.css` using
  CSS custom properties (`var(--rust)`, `var(--bottle)`, etc. for semantic tones).
- No test suite currently exists.
- `canLoadDemoData` and admin-owner status are gated to a single owner email in
  `AuthGate.jsx` — the demo-data button is a dev convenience, not a real feature.
