// Persistence layer for Align.
//
// Today this is backed by localStorage, so the app works fully offline with
// zero setup. The get/set shape ({ value } / Promise) matches what a Firebase
// Firestore-backed implementation would look like, so swapping the backing
// store later (see README) won't require touching any of the app code that
// calls storage.get/storage.set.

export const storage = {
  async get(key) {
    try {
      const value = window.localStorage.getItem(key);
      return { value };
    } catch {
      // Storage can be unavailable (private browsing, disabled cookies, etc).
      return { value: null };
    }
  },

  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Fail silently — the app still works in-memory for the session.
    }
  },
};
