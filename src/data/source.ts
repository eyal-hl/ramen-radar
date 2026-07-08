import type { FirestorePlace } from '../domain/firestore-model';

export async function loadPublicPlaces(): Promise<FirestorePlace[]> {
  return (await import('../firebase/places')).listPublicPlaces();
}

export async function loadPublicPlace(id: string): Promise<FirestorePlace | null> {
  return (await import('../firebase/places')).getPublicPlace(id);
}
