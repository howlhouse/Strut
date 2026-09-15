import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth, googleProvider } from "./firebase.js";
import { makeFirestoreStorage } from "./storage.js";
import { upsertOwnProfile, getOwnAdminFlag } from "./adminData.js";
import { useTheme } from "./useTheme.js";
import App from "./App.jsx";
import strutMark from "./assets/strut-mark.svg";
import "./theme.css";

// The "Load demo data" button is a testing convenience, not a real feature —
// only show it to the app's own developer/owner account, not every new
// sign-up. This same account is always treated as an admin (see
// firestore.rules), regardless of the /admins collection.
const OWNER_EMAIL = "howlhousemedia@gmail.com";

// Gates the app behind Google Sign-In so Firestore can scope each user's
// data to their own uid (see firestore.rules) — without this, anyone who
// found the app's public Firebase config could read or overwrite the data.
export default function AuthGate() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { mode: themeMode, setMode: setThemeMode, effective: theme } = useTheme();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Keep the shared account-info record current, and resolve whether this
  // account has admin access, whenever a user signs in.
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    if (user.email === OWNER_EMAIL) setIsAdmin(true);
    upsertOwnProfile(user).catch(() => {});
    getOwnAdminFlag(user.uid).then((flag) => {
      if (user.email !== OWNER_EMAIL) setIsAdmin(flag);
    }).catch(() => {});
  }, [user]);

  const handleSignIn = async () => {
    setError("");
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(e.code === "auth/popup-closed-by-user" ? "" : e.message);
    } finally {
      setSigningIn(false);
    }
  };

  if (user === undefined) {
    return (
      <Screen theme={theme}>
        <img src={strutMark} className="gate-mark" alt="" />
        <p className="gate-text">Loading…</p>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen theme={theme}>
        <img src={strutMark} className="gate-mark" alt="Strut" />
        <h1 className="gate-title">Strut</h1>
        <p className="gate-text">Sign in to sync your data across devices.</p>
        <button className="gate-btn" onClick={handleSignIn} disabled={signingIn}>
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
        {error && <p className="gate-error">{error}</p>}
      </Screen>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="gate-bar">
        <span>{user.email}</span>
        <button className="gate-bar-btn" onClick={() => signOut(auth)} title="Sign out">
          <LogOut size={13} /> Sign out
        </button>
      </div>
      <App
        storage={makeFirestoreStorage(user.uid)}
        canLoadDemoData={user.email === OWNER_EMAIL}
        isAdmin={isAdmin}
        isOwner={user.email === OWNER_EMAIL}
        currentUser={user}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
      />
    </div>
  );
}

function Screen({ theme, children }) {
  return (
    <div className="gate" data-theme={theme}>
      {children}
    </div>
  );
}
