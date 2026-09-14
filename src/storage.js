// Firestore-backed persistence for Strut, scoped per signed-in user.
//
// Everything the app saves lives in one document per user:
//   users/{uid}/strut/data
// keyed by the same string keys the app already calls storage.get/set with
// (e.g. "finance-data"). Access is restricted to that uid by firestore.rules.
// The persistent local cache configured in firebase.js keeps this working
// offline and syncing automatically once back online.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export function makeFirestoreStorage(uid) {
  const ref = doc(db, "users", uid, "strut", "data");

  return {
    async get(key) {
      try {
        const snap = await getDoc(ref);
        const value = snap.exists() ? snap.data()[key] : undefined;
        return { value: value ?? null };
      } catch {
        return { value: null };
      }
    },

    async set(key, value) {
      await setDoc(ref, { [key]: value }, { merge: true });
    },
  };
}
