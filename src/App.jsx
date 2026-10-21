import { useState, useEffect } from "react";
import {
  X, Settings as SettingsIcon, PanelLeftClose, PanelLeftOpen, Menu, ShieldCheck,
  PartyPopper, CalendarDays, Megaphone, ClipboardCheck,
} from "lucide-react";
import "./theme.css";
import strutMark from "./assets/strut-mark.svg";
import strutWordmarkLight from "./assets/strut-wordmark-light.svg";
import strutWordmarkDark from "./assets/strut-wordmark-dark.svg";
import { getCatalog, setCatalog as saveCatalog, DEFAULT_CATALOG } from "./catalog.js";

import { uid } from "./utils/format";

import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import CommunityModule from "./community/CommunityModule";

export default function App({ isAdmin, isOwner, currentUser, themeMode, setThemeMode }) {
  const [tab, setTab] = useState("events");
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

  // The shared tag/category catalog (edited from the Admin Console).
  const [catalog, setCatalogState] = useState(DEFAULT_CATALOG);

  useEffect(() => {
    getCatalog().then(setCatalogState);
  }, []);

  // Catalog edits (admin only, enforced by firestore.rules) replace the
  // whole shared doc — it's tiny, so this clones, mutates and persists
  // without needing a merge strategy.
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

  const COMMUNITY_TAB_IDS = ["events", "calendar", "my-events", "manage"];
  const nav = [
    { id: "events", label: "Events", icon: PartyPopper },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "my-events", label: "My Listings", icon: Megaphone },
    ...(isAdmin ? [{ id: "manage", label: "Manage Events", icon: ClipboardCheck }] : []),
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
        {COMMUNITY_TAB_IDS.includes(tab) && (
          <CommunityModule tab={tab} currentUser={currentUser} isAdmin={isAdmin} />
        )}
        {tab === "settings" && (
          <SettingsPage themeMode={themeMode} setThemeMode={setThemeMode} />
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
