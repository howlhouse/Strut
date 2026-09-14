// Firebase project config for Strut. This is a public client identifier
// (not a secret) — access control is enforced by Firestore security rules
// (see firestore.rules), not by hiding this object.
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

const firebaseConfig = {
  projectId: "strut-for-me",
  appId: "1:869154259227:web:0712dca2b87097111893be",
  storageBucket: "strut-for-me.firebasestorage.app",
  apiKey: "AIzaSyCaJ4W2FZimtT_7Lb5DQxB_mqDCOFNn_nE",
  authDomain: "strut-for-me.firebaseapp.com",
  messagingSenderId: "869154259227",
  measurementId: "G-S92K8ZFBEF",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Persistent local cache keeps the app usable offline (reads/writes queue in
// IndexedDB and sync once back online), instead of failing without a
// connection.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
