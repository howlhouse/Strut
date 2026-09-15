// Firestore-backed storage for the shared tag/category catalog — one doc,
// readable by every signed-in user, writable only by an admin (see
// firestore.rules). Mirrors the get/set shape of storage.js.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export const DEFAULT_CATALOG = { categories: [], tags: [] };

const ref = doc(db, "catalog", "shared");

export async function getCatalog() {
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? { ...DEFAULT_CATALOG, ...snap.data() } : DEFAULT_CATALOG;
  } catch {
    return DEFAULT_CATALOG;
  }
}

export async function setCatalog(catalog) {
  await setDoc(ref, catalog);
}
