// Firestore-backed account-level data used by the Admin Console: user
// profiles and admin-access flags. Deliberately separate from storage.js
// (per-user financial data) — none of this touches a user's bills, cards or
// transactions (see firestore.rules).
import { collection, doc, getDoc, getDocs, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// Called on every sign-in to keep the account list current. Never writes an
// admin flag — that lives only in the separate /admins collection.
export async function upsertOwnProfile(user) {
  const ref = doc(db, "userProfiles", user.uid);
  const existing = await getDoc(ref).catch(() => null);
  const payload = {
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    lastLoginAt: serverTimestamp(),
  };
  if (!existing?.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
}

export async function getOwnAdminFlag(uid) {
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function listUserProfiles() {
  const snap = await getDocs(collection(db, "userProfiles"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function listAdminUids() {
  const snap = await getDocs(collection(db, "admins"));
  return snap.docs.map((d) => d.id);
}

export async function setAdminAccess(uid, isAdmin, email) {
  const ref = doc(db, "admins", uid);
  if (isAdmin) await setDoc(ref, { email: email || "" });
  else await deleteDoc(ref);
}
