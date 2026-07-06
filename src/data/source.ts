import type { FirestorePlace } from '../domain/firestore-model';

const fixtureMode = import.meta.env.PUBLIC_DATA_MODE === 'fixture';

export async function loadPublicPlaces(): Promise<FirestorePlace[]> {
  if (fixtureMode) return (await import('./seed')).seedPlaces.filter(({ archived }) => !archived);
  return (await import('../firebase/places')).listPublicPlaces();
}

export async function loadPublicPlace(id: string): Promise<FirestorePlace | null> {
  if (fixtureMode) {
    return (await import('./seed')).seedPlaces.find((place) => place.id === id && !place.archived) ?? null;
  }
  return (await import('../firebase/places')).getPublicPlace(id);
}
