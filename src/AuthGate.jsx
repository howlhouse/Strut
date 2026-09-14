import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth, googleProvider } from "./firebase.js";
import { makeFirestoreStorage } from "./storage.js";
import { useTheme } from "./useTheme.js";
import App from "./App.jsx";
import "./theme.css";

// The "Load demo data" button is a testing convenience, not a real feature —
// only show it to the app's own developer/owner account, not every new
// sign-up.
const OWNER_EMAIL = "howlhousemedia@gmail.com";

// Gates the app behind Google Sign-In so Firestore can scope each user's
// data to their own uid (see firestore.rules) — without this, anyone who
// found the app's public Firebase config could read or overwrite the data.
export default function AuthGate() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const { mode: themeMode, setMode: setThemeMode, effective: theme } = useTheme();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

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
        <p className="gate-text">Loading…</p>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen theme={theme}>
        <span className="gate-mark">S</span>
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
