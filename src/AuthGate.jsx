import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth, googleProvider } from "./firebase.js";
import { makeFirestoreStorage } from "./storage.js";
import App from "./App.jsx";

// Gates the app behind Google Sign-In so Firestore can scope each user's
// data to their own uid (see firestore.rules) — without this, anyone who
// found the app's public Firebase config could read or overwrite the data.
export default function AuthGate() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

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
      <Screen>
        <p className="gate-text">Loading…</p>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <span className="gate-mark">§</span>
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
    <div>
      <div className="gate-bar">
        <span>{user.email}</span>
        <button className="gate-bar-btn" onClick={() => signOut(auth)} title="Sign out">
          <LogOut size={13} /> Sign out
        </button>
      </div>
      <App storage={makeFirestoreStorage(user.uid)} />
    </div>
  );
}

function Screen({ children }) {
  return (
    <div className="gate">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .gate {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #E8EDE3;
          color: #1F2E23;
          font-family: 'IBM Plex Sans', sans-serif;
          text-align: center;
          padding: 24px;
        }
        .gate-mark { font-family: 'Source Serif 4', serif; font-size: 32px; color: #B8925A; }
        .gate-title { font-family: 'Source Serif 4', serif; font-size: 28px; font-weight: 600; margin: 0; }
        .gate-text { color: #5B6B5E; font-size: 14px; margin: 0 0 6px; }
        .gate-btn {
          border: 1px solid #2F4A3C; background: #2F4A3C; color: #F7F5EF;
          padding: 10px 20px; font-family: inherit; font-size: 14px; font-weight: 500;
          border-radius: 3px; cursor: pointer;
        }
        .gate-btn:hover { opacity: 0.92; }
        .gate-btn:disabled { opacity: 0.6; cursor: default; }
        .gate-error { color: #A33D2C; font-size: 12.5px; max-width: 320px; }
        .gate-bar {
          display: flex; align-items: center; justify-content: flex-end; gap: 12px;
          padding: 8px 16px; background: #F7F5EF; border-bottom: 1px solid #CBD3C3;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; color: #5B6B5E;
        }
        .gate-bar-btn {
          display: inline-flex; align-items: center; gap: 5px;
          border: 1px solid #CBD3C3; background: transparent; color: #5B6B5E;
          font-family: inherit; font-size: 12px; padding: 4px 9px;
          border-radius: 3px; cursor: pointer;
        }
        .gate-bar-btn:hover { color: #A33D2C; border-color: #A33D2C; }
      `}</style>
      {children}
    </div>
  );
}
