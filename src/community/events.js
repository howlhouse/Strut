// Firestore access for the Community module: one flat collection,
// communityEvents/{id}. Visibility and who-may-change-what is enforced in
// firestore.rules, so each subscription below asks for exactly the slice the
// rules allow that kind of user to read (rules reject over-broad queries).
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";

const col = collection(db, "communityEvents");
const toEvents = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const watch = (q, onData, onError) => onSnapshot(q, (snap) => onData(toEvents(snap)), onError);

// Everyone signed in: what's live.
export const subscribePublishedEvents = (onData, onError) =>
  watch(query(col, where("status", "==", "published")), onData, onError);

// A promoter's own listings, whatever their status.
export const subscribeOwnEvents = (ownerUid, onData, onError) =>
  watch(query(col, where("ownerUid", "==", ownerUid)), onData, onError);

// Admins only: every listing from every promoter.
export const subscribeAllEvents = (onData, onError) => watch(col, onData, onError);

// New listings always start as pending/unpaid/unfeatured — the rules require
// that of non-admins. Admins may override via `extra` (e.g. post directly
// as published).
export async function createEvent(fields, ownerUid, extra = {}) {
  await addDoc(col, {
    ...fields,
    ownerUid,
    status: "pending",
    featured: false,
    feePaid: false,
    feeAmount: 0,
    ...extra,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export const updateEvent = (id, patch) =>
  updateDoc(doc(db, "communityEvents", id), { ...patch, updatedAt: serverTimestamp() });

export const removeEvent = (id) => deleteDoc(doc(db, "communityEvents", id));
