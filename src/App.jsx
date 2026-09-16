import { useState, useEffect } from "react";
import {
  X, LayoutDashboard, Receipt, Ticket, Wallet, Landmark, TrendingUp,
  Settings as SettingsIcon, PanelLeftClose, PanelLeftOpen, Menu,
  BarChart3, PiggyBank, ShieldCheck,
} from "lucide-react";
import "./theme.css";
import strutMark from "./assets/strut-mark.svg";
import strutWordmarkLight from "./assets/strut-wordmark-light.svg";
import strutWordmarkDark from "./assets/strut-wordmark-dark.svg";
import { getCatalog, setCatalog as saveCatalog, DEFAULT_CATALOG } from "./catalog.js";

import { uid } from "./utils/format";
import { DEFAULT_DATA, CARD_COLORS } from "./utils/constants";
import { fundingSource, isBankAccountId } from "./utils/funding";
import { billDueInfo, billEstimatedAmount } from "./utils/bills";
import { startOfMonth } from "./utils/months";
import { buildDemoData } from "./utils/demoData";

import Dashboard from "./pages/Dashboard";
import BillsPage from "./pages/BillsPage";
import BudgetsPage from "./pages/BudgetsPage";
import LayawayPage from "./pages/LayawayPage";
import CardsPage from "./pages/CardsPage";
import BankAccountsPage from "./pages/BankAccountsPage";
import ForecastPage from "./pages/ForecastPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";

export default function App({ storage, canLoadDemoData, isAdmin, isOwner, currentUser, themeMode, setThemeMode }) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("strut-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem("strut-sidebar-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  // On phones/tablets the sidebar becomes an off-canvas drawer instead of a
  // rail — this tracks whether that drawer is open, independent of the
  // desktop full/collapsed-rail preference above.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // The shared tag/category catalog, and which month Dashboard/Bills are
  // currently browsing (defaults to the real current month on every load).
  const [catalog, setCatalogState] = useState(DEFAULT_CATALOG);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("finance-data");
        if (r?.value) setData({ ...DEFAULT_DATA, ...JSON.parse(r.value) });
      } catch (e) {
        /* no saved data yet */
      }
      setLoaded(true);
    })();
    getCatalog().then((c) => { setCatalogState(c); setCatalogLoaded(true); });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set("finance-data", JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  const update = (fn) => setData((prev) => fn(structuredClone(prev)));

  // Catalog edits (admin only, enforced by firestore.rules) replace the
  // whole shared doc — it's tiny, so this mirrors `update()`'s
  // clone-mutate-persist pattern without needing a merge strategy.
  const updateCatalog = (fn) => {
    setCatalogState((prev) => {
      const next = fn(structuredClone(prev));
      saveCatalog(next).catch(() => {});
      return next;
    });
  };
  const addCategory = (cat) => updateCatalog((c) => { c.categories.push({ id: uid(), ...cat }); return c; });
  const updateCategoryEntry = (id, patch) => updateCatalog((c) => {
    const cat = c.categories.find((x) => x.id === id);
    if (cat) Object.assign(cat, patch);
    return c;
  });
  const deleteCategoryEntry = (id) => updateCatalog((c) => { c.categories = c.categories.filter((x) => x.id !== id); return c; });
  const addTag = (tag) => updateCatalog((c) => { c.tags.push({ id: uid(), ...tag }); return c; });
  const updateTagEntry = (id, patch) => updateCatalog((c) => {
    const t = c.tags.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
    return c;
  });
  const deleteTagEntry = (id) => updateCatalog((c) => { c.tags = c.tags.filter((x) => x.id !== id); return c; });

  /* ---- budget actions ---- */
  const addBudget = (budget) => update((d) => { d.budgets = d.budgets || []; d.budgets.push({ id: uid(), ...budget }); return d; });
  const updateBudget = (id, patch) => update((d) => {
    const b = (d.budgets || []).find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return d;
  });
  const deleteBudget = (id) => update((d) => { d.budgets = (d.budgets || []).filter((b) => b.id !== id); return d; });

  const cardName = (id) => fundingSource(data, id)?.name || "—";
  const cardColor = (id) => {
    const idx = [...data.cards, ...(data.bankAccounts || [])].findIndex((s) => s.id === id);
    return CARD_COLORS[idx % CARD_COLORS.length] || "var(--ink-soft)";
  };

  /* ---- bill actions ---- */
  const addBill = (bill) => update((d) => { d.bills.push({ id: uid(), ...bill }); return d; });
  const updateBill = (id, patch) => update((d) => {
    const b = d.bills.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return d;
  });
  const deleteBill = (id) => update((d) => {
    d.bills = d.bills.filter((b) => b.id !== id);
    const removedTxIds = [];
    Object.values(d.billPayments).forEach((m) => { if (m[id]?.txId) removedTxIds.push(m[id].txId); delete m[id]; });
    d.cardTransactions = d.cardTransactions.filter((t) => !removedTxIds.includes(t.id));
    d.accountTransactions = (d.accountTransactions || []).filter((t) => !removedTxIds.includes(t.id));
    return d;
  });

  // cardId here is really "funding source id" — a bill can be pinned to
  // either a card or a plain bank account (see fundingSource above), so the
  // resulting payment transaction is routed to whichever ledger it belongs to.
  const toggleBillPaid = (bill, key, checked, paidDate, cardId, amount) => update((d) => {
    d.billPayments[key] = d.billPayments[key] || {};
    const existing = d.billPayments[key][bill.id];
    if (checked) {
      if (existing?.txId) {
        d.cardTransactions = d.cardTransactions.filter((t) => t.id !== existing.txId);
        d.accountTransactions = (d.accountTransactions || []).filter((t) => t.id !== existing.txId);
      }
      const amt = amount != null && amount !== "" ? Number(amount) : billEstimatedAmount(bill, key);
      const txId = uid();
      if (cardId) {
        const tx = { id: txId, date: paidDate, amount: amt, type: "charge", description: bill.name, source: "bill", ref: bill.id, categoryId: bill.categoryId || null, tagIds: bill.tagIds || [] };
        if (isBankAccountId(d, cardId)) d.accountTransactions.push({ ...tx, accountId: cardId });
        else d.cardTransactions.push({ ...tx, cardId });
      }
      d.billPayments[key][bill.id] = { paid: true, paidDate, cardId, amount: amt, txId: cardId ? txId : null };
      const billRef = d.bills.find((b) => b.id === bill.id);
      if (billRef) {
        // Keep the bill's default estimate current so next cycle starts from the latest known
        // amount — but only when this write IS the bill's current cycle. Backfilling an older
        // month's history (see BillHistory) uses this same action with a past key, and must not
        // clobber the live forecast estimate with an out-of-date amount.
        if (key === billDueInfo(bill).key) billRef.amount = amt;
        // This cycle is now actually paid, so any preloaded schedule entry for it is fulfilled —
        // drop it so it stops showing up as "upcoming".
        if (billRef.scheduledAmounts?.[key] != null) {
          const { [key]: _dropped, ...rest } = billRef.scheduledAmounts;
          billRef.scheduledAmounts = rest;
        }
      }
    } else {
      if (existing?.txId) {
        d.cardTransactions = d.cardTransactions.filter((t) => t.id !== existing.txId);
        d.accountTransactions = (d.accountTransactions || []).filter((t) => t.id !== existing.txId);
      }
      delete d.billPayments[key][bill.id];
    }
    return d;
  });

  /* ---- layaway actions ---- */
  const addFestival = (fest) => update((d) => { d.layaways.push({ id: uid(), ...fest }); return d; });
  const deleteFestival = (id) => update((d) => {
    const fest = d.layaways.find((f) => f.id === id);
    const instIds = fest ? fest.installments.map((i) => i.id) : [];
    d.cardTransactions = d.cardTransactions.filter((t) => !(t.source === "layaway" && instIds.includes(t.ref)));
    d.layaways = d.layaways.filter((f) => f.id !== id);
    return d;
  });
  const updateFestivalMeta = (id, patch) => update((d) => {
    const f = d.layaways.find((x) => x.id === id);
    if (f) Object.assign(f, patch);
    return d;
  });

  const toggleInstallmentPaid = (fest, inst, checked, paidDate) => update((d) => {
    const f = d.layaways.find((x) => x.id === fest.id);
    const i = f.installments.find((x) => x.id === inst.id);
    if (checked) {
      if (i.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== i.txId);
      const txId = uid();
      if (f.cardId) {
        d.cardTransactions.push({ id: txId, cardId: f.cardId, date: paidDate, amount: i.amount, type: "charge", description: `${f.festivalName} payment`, source: "layaway", ref: i.id });
      }
      i.paid = true; i.paidDate = paidDate; i.txId = f.cardId ? txId : null;
    } else {
      if (i.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== i.txId);
      i.paid = false; i.paidDate = null; i.txId = null;
    }
    return d;
  });

  const addInstallment = (festId, entry) => update((d) => {
    const f = d.layaways.find((x) => x.id === festId);
    f.installments.push({ id: uid(), amount: Number(entry.amount), dueDate: entry.dueDate, paid: false, paidDate: null, txId: null });
    return d;
  });
  const deleteInstallment = (festId, instId) => update((d) => {
    const f = d.layaways.find((x) => x.id === festId);
    const inst = f.installments.find((x) => x.id === instId);
    if (inst?.txId) d.cardTransactions = d.cardTransactions.filter((t) => t.id !== inst.txId);
    f.installments = f.installments.filter((x) => x.id !== instId);
    return d;
  });
  const updateInstallment = (festId, instId, patch) => update((d) => {
    const f = d.layaways.find((x) => x.id === festId);
    const inst = f.installments.find((x) => x.id === instId);
    Object.assign(inst, patch);
    if (inst.txId && patch.amount !== undefined) {
      const tx = d.cardTransactions.find((t) => t.id === inst.txId);
      if (tx) tx.amount = Number(patch.amount);
    }
    return d;
  });

  /* ---- card actions ---- */
  const addCard = (card) => update((d) => { d.cards.push({ id: uid(), ...card }); return d; });
  const deleteCard = (id) => update((d) => {
    d.cards = d.cards.filter((c) => c.id !== id);
    d.cardTransactions = d.cardTransactions.filter((t) => t.cardId !== id);
    return d;
  });
  // fundingId is either a card id or a bank account id (see fundingSource) —
  // routed to whichever ledger it belongs to. Used for both the Cards page's
  // "Add transaction" and the Bank Accounts page's "Log a transaction".
  const addTransaction = (fundingId, tx) => update((d) => {
    if (isBankAccountId(d, fundingId)) d.accountTransactions.push({ id: uid(), accountId: fundingId, source: "manual", ...tx });
    else d.cardTransactions.push({ id: uid(), cardId: fundingId, source: "manual", ...tx });
    return d;
  });
  const deleteTransaction = (id) => update((d) => {
    const tx = d.cardTransactions.find((t) => t.id === id) || (d.accountTransactions || []).find((t) => t.id === id);
    d.cardTransactions = d.cardTransactions.filter((t) => t.id !== id);
    d.accountTransactions = (d.accountTransactions || []).filter((t) => t.id !== id);
    if (tx?.source === "bill") {
      Object.values(d.billPayments).forEach((m) => { Object.keys(m).forEach((bid) => { if (m[bid].txId === id) delete m[bid]; }); });
    }
    if (tx?.source === "layaway") {
      d.layaways.forEach((f) => f.installments.forEach((i) => { if (i.txId === id) { i.paid = false; i.paidDate = null; i.txId = null; } }));
    }
    return d;
  });
  // Only ever called on a manually-logged transaction (bill/layaway-sourced
  // ones stay editable only through their own flow, so the linked
  // bill/installment payment record can't drift out of sync with the ledger).
  const updateTransaction = (id, patch) => update((d) => {
    const tx = d.cardTransactions.find((t) => t.id === id) || (d.accountTransactions || []).find((t) => t.id === id);
    if (tx) Object.assign(tx, patch);
    return d;
  });

  /* ---- bank account actions ---- */
  const addBankAccount = (account) => update((d) => { d.bankAccounts.push({ id: uid(), ...account }); return d; });
  const updateBankAccount = (id, patch) => update((d) => {
    const a = d.bankAccounts.find((x) => x.id === id);
    if (a) Object.assign(a, patch);
    return d;
  });
  const deleteBankAccount = (id) => update((d) => {
    d.bankAccounts = d.bankAccounts.filter((a) => a.id !== id);
    d.accountTransactions = (d.accountTransactions || []).filter((t) => t.accountId !== id);
    return d;
  });

  /* ---- income (paycheck) actions ---- */
  const addIncome = (income) => update((d) => { d.incomes.push({ id: uid(), ...income }); return d; });
  const deleteIncome = (id) => update((d) => { d.incomes = d.incomes.filter((i) => i.id !== id); return d; });

  /* ---- settings actions ---- */
  const updateSettings = (patch) => update((d) => {
    d.settings = { ...(d.settings || DEFAULT_DATA.settings), ...patch };
    return d;
  });

  const loadDemo = () => setData(buildDemoData());
  const clearAll = () => {
    if (window.confirm("Clear all data and start fresh? This can't be undone.")) setData(structuredClone(DEFAULT_DATA));
  };

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "bills", label: "Bills", icon: Receipt },
    { id: "budgets", label: "Budgets", icon: PiggyBank },
    { id: "layaway", label: "Layaway Payments", icon: Ticket },
    { id: "cards", label: "Card ledgers", icon: Wallet },
    { id: "accounts", label: "Bank Accounts", icon: Landmark },
    { id: "forecast", label: "Forecast", icon: TrendingUp },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    ...(isAdmin ? [{ id: "admin", label: "Admin Console", icon: ShieldCheck }] : []),
  ];

  const goTo = (id) => {
    setTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app">
      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} title="Open menu" aria-label="Open menu">
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <Wordmark />
      </div>

      {mobileMenuOpen && <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />}

      <aside className={"sidebar" + (sidebarCollapsed ? " collapsed" : "") + (mobileMenuOpen ? " mobile-open" : "")}>
        <div className="brand">
          <Wordmark />
          <img src={strutMark} className="brand-mark" alt="Strut" />
          <button className="sidebar-close" onClick={() => setMobileMenuOpen(false)} title="Close menu" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={"nav-item" + (tab === n.id ? " active" : "")} onClick={() => goTo(n.id)} title={n.label}>
              <n.icon size={16} strokeWidth={1.75} />
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
            <span className="nav-label">{sidebarCollapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        {tab === "dashboard" && (
          <Dashboard
            data={data}
            catalog={catalog}
            cardName={cardName}
            cardColor={cardColor}
            toggleBillPaid={toggleBillPaid}
            toggleInstallmentPaid={toggleInstallmentPaid}
            updateBill={updateBill}
            deleteBill={deleteBill}
            loadDemo={loadDemo}
            canLoadDemoData={canLoadDemoData}
            addTransaction={addTransaction}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
        )}
        {tab === "bills" && (
          <BillsPage
            data={data}
            catalog={catalog}
            addBill={addBill}
            updateBill={updateBill}
            deleteBill={deleteBill}
            toggleBillPaid={toggleBillPaid}
            cardColor={cardColor}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
        )}
        {tab === "budgets" && (
          <BudgetsPage
            data={data}
            catalog={catalog}
            addBudget={addBudget}
            updateBudget={updateBudget}
            deleteBudget={deleteBudget}
            addTag={addTag}
            isAdmin={isAdmin}
          />
        )}
        {tab === "layaway" && (
          <LayawayPage
            data={data}
            addFestival={addFestival}
            deleteFestival={deleteFestival}
            updateFestivalMeta={updateFestivalMeta}
            toggleInstallmentPaid={toggleInstallmentPaid}
            addInstallment={addInstallment}
            deleteInstallment={deleteInstallment}
            updateInstallment={updateInstallment}
            cardColor={cardColor}
          />
        )}
        {tab === "cards" && (
          <CardsPage data={data} catalog={catalog} addCard={addCard} deleteCard={deleteCard} addTransaction={addTransaction} deleteTransaction={deleteTransaction} cardColor={cardColor} />
        )}
        {tab === "accounts" && (
          <BankAccountsPage data={data} catalog={catalog} addBankAccount={addBankAccount} updateBankAccount={updateBankAccount} deleteBankAccount={deleteBankAccount} addTransaction={addTransaction} updateTransaction={updateTransaction} deleteTransaction={deleteTransaction} />
        )}
        {tab === "forecast" && (
          <ForecastPage data={data} addIncome={addIncome} deleteIncome={deleteIncome} />
        )}
        {tab === "analytics" && <AnalyticsPage data={data} catalog={catalog} />}
        {tab === "settings" && (
          <SettingsPage
            settings={data.settings || DEFAULT_DATA.settings}
            updateSettings={updateSettings}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            canLoadDemoData={canLoadDemoData}
            loadDemo={loadDemo}
            clearAll={clearAll}
          />
        )}
        {tab === "admin" && isAdmin && (
          <AdminPage
            catalog={catalog}
            addCategory={addCategory}
            updateCategoryEntry={updateCategoryEntry}
            deleteCategoryEntry={deleteCategoryEntry}
            addTag={addTag}
            updateTagEntry={updateTagEntry}
            deleteTagEntry={deleteTagEntry}
            isOwner={isOwner}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}

// Strut wordmark image — swaps light/dark variant purely via CSS
// ([data-theme] display toggle) so it always matches the active theme
// with no extra prop plumbing.
function Wordmark() {
  return (
    <span className="brand-wordmark">
      <img src={strutWordmarkLight} className="wordmark-light" alt="Strut" />
      <img src={strutWordmarkDark} className="wordmark-dark" alt="Strut" />
    </span>
  );
}
