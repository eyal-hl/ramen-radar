import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  type Firestore,
} from 'firebase/firestore';
import { assertCurrentVersion } from '../domain/concurrency';
import {
  parsePlaceDocument,
  publicPlaces,
  toFirestorePlace,
  type FirestorePlace,
} from '../domain/firestore-model';
import { getFirebaseServices } from './client';
import { isPermissionDenied } from './errors';

function databaseOrDefault(database?: Firestore): Firestore {
  return database ?? getFirebaseServices().database;
}

export async function listPublicPlaces(database?: Firestore): Promise<FirestorePlace[]> {
  const db = databaseOrDefault(database);
  const snapshot = await getDocs(query(collection(db, 'places'), where('archived', '==', false)));
  return publicPlaces(snapshot.docs.map((entry) => parsePlaceDocument(entry.data())));
}

export async function listEditorPlaces(database?: Firestore): Promise<FirestorePlace[]> {
  const snapshot = await getDocs(collection(databaseOrDefault(database), 'places'));
  return snapshot.docs.map((entry) => parsePlaceDocument(entry.data()));
}

export async function getPublicPlace(id: string, database?: Firestore): Promise<FirestorePlace | null> {
  try {
    const snapshot = await getDoc(doc(databaseOrDefault(database), 'places', id));
    if (!snapshot.exists()) return null;
    const place = parsePlaceDocument(snapshot.data());
    return place.archived ? null : place;
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

export async function isApprovedEditor(uid: string, database?: Firestore): Promise<boolean> {
  const snapshot = await getDoc(doc(databaseOrDefault(database), 'editors', uid));
  return snapshot.exists();
}

export async function savePlace(
  input: FirestorePlace,
  expectedUpdatedAt: string | undefined,
  database?: Firestore,
): Promise<FirestorePlace> {
  const db = databaseOrDefault(database);
  const reference = doc(db, 'places', input.id);
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(reference);
    const currentUpdatedAt = current.exists()
      ? parsePlaceDocument(current.data()).updatedAt
      : undefined;
    assertCurrentVersion(expectedUpdatedAt, currentUpdatedAt);
    const saved = toFirestorePlace(input, new Date().toISOString());
    transaction.set(reference, saved);
    return saved;
  });
}
