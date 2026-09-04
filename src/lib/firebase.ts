import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { JournalEntry, UserProfile, WeeklyGoalRecord } from "../types";

// 1. Initialize Firebase Client App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Initialize Firebase Authentication
export const auth = getAuth(app);

// 3. Initialize Firestore with specific custom database ID
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Helper to format Auth User
export function mapUser(user: User | null): UserProfile | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.isAnonymous ? "Guest Explorer" : user.email?.split("@")[0] || "User"),
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous
  };
}

// Authentication Handlers
export async function signInWithGoogle(): Promise<UserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  return mapUser(result.user)!;
}

export async function signInWithEmail(email: string, pass: string): Promise<UserProfile> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return mapUser(result.user)!;
}

export async function signUpWithEmail(email: string, pass: string): Promise<UserProfile> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return mapUser(result.user)!;
}

export async function signInAsGuest(): Promise<UserProfile> {
  const result = await signInAnonymously(auth);
  return mapUser(result.user)!;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Isolated Cloud Firestore Persistence
 * Security Architecture: All writes and reads strictly query `/users/{userId}/entries`
 * Cross-tenant queries are blocked by `firestore.rules`.
 */

export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
) {
  if (!userId) return () => {};

  const entriesRef = collection(db, "users", userId, "entries");
  const q = query(entriesRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as JournalEntry);
      });
      onUpdate(items);
    },
    (err) => {
      console.error("[Firestore Isolation Error]:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Recursively strips any keys with `undefined` values from an object or nested objects/arrays.
 * Cloud Firestore strictly rejects objects containing `undefined` with "Unsupported field value: undefined".
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === "object" && item !== null ? sanitizeFirestoreData(item) : item)) as unknown as T;
  }
  if (typeof obj === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue;
      }
      if (value !== null && typeof value === "object") {
        cleaned[key] = sanitizeFirestoreData(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned as T;
  }
  return obj;
}

export async function saveUserJournalEntry(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId) throw new Error("Security Violation: User must be authenticated to write to Firestore.");
  
  // Ensure parent user document exists for listing
  const userDocRef = doc(db, "users", userId);
  await setDoc(userDocRef, { lastActive: Date.now(), userId }, { merge: true });

  const docRef = doc(db, "users", userId, "entries", entry.id);
  const payloadToStore = sanitizeFirestoreData({
    ...entry,
    userId, // Enforce tenant ownership
    updatedAt: Date.now()
  });

  await setDoc(docRef, payloadToStore, { merge: true });
}

export async function deleteUserJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error("Security Violation: Invalid parameters.");
  const docRef = doc(db, "users", userId, "entries", entryId);
  await deleteDoc(docRef);
}

/**
 * Weekly Goals Subscription (users/{userId}/goals)
 * Loaded by Sunday 9:00 AM Cron & Gemini Synthesis
 */
export function subscribeToUserGoals(
  userId: string,
  onUpdate: (goals: WeeklyGoalRecord[]) => void,
  onError?: (error: Error) => void
) {
  if (!userId) return () => {};

  const goalsRef = collection(db, "users", userId, "goals");
  const q = query(goalsRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WeeklyGoalRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as WeeklyGoalRecord);
      });
      onUpdate(items);
    },
    (err) => {
      console.error("[Firestore Goals Subscription Error]:", err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserGoalRecord(userId: string, goalRecord: WeeklyGoalRecord): Promise<void> {
  if (!userId) throw new Error("Security Violation: User must be authenticated to write goals.");
  const docRef = doc(db, "users", userId, "goals", goalRecord.id);
  const payload = sanitizeFirestoreData({
    ...goalRecord,
    userId,
    updatedAt: Date.now()
  });
  await setDoc(docRef, payload, { merge: true });
}

/**
 * GDPR Right-to-Erasure (Data Sovereignty)
 * Irreversibly purges all records within the authenticated user's isolated subcollection.
 */
export async function purgeAllUserData(userId: string): Promise<number> {
  if (!userId) throw new Error("User ID is required for data purge.");
  const entriesRef = collection(db, "users", userId, "entries");
  const snapshot = await getDocs(entriesRef);

  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  let count = 0;
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count++;
  });

  await batch.commit();
  return count;
}
