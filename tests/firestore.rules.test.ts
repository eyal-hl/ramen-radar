import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';

const projectId = 'ramen-radar-rules-test';
let environment: RulesTestEnvironment;

const place = {
  id: 'test-place', fictional: false, name: 'Test Place', description: 'A test place.',
  status: 'want-to-visit', addedAt: '2026-07-06',
  location: { address: '1 Test St', city: 'Givatayim', latitude: 32.07, longitude: 34.81, mapUrl: 'https://maps.google.com/' },
  links: {}, priceRange: '$$', currency: 'ILS', ramenStyles: [], dietaryOptions: [], tags: [],
  coverImage: { src: '/images/places/unvisited/placeholder.svg', alt: 'Placeholder bowl' },
  gallery: [], visits: [], archived: false, updatedAt: '2026-07-06T10:00:00.000Z',
};

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(resolve('firestore.rules'), 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'places', place.id), place);
    await setDoc(doc(context.firestore(), 'places', 'archived-place'), { ...place, id: 'archived-place', archived: true });
    await setDoc(doc(context.firestore(), 'editors', 'approved-user'), { email: 'approved@example.com' });
  });
});

afterAll(async () => environment.cleanup());

describe('Firestore Security Rules', () => {
  test('the public can read active places but not archived places', async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, 'places', place.id)));
    await assertFails(getDoc(doc(database, 'places', 'archived-place')));
    await assertSucceeds(getDocs(query(
      (await import('firebase/firestore')).collection(database, 'places'),
      where('archived', '==', false),
    )));
  });

  test('an unapproved user cannot write', async () => {
    const database = environment.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(database, 'places', 'new-place'), { ...place, id: 'new-place' }));
  });

  test('an approved editor can create, update, and read archived places', async () => {
    const database = environment.authenticatedContext('approved-user').firestore();
    await assertSucceeds(setDoc(doc(database, 'places', 'new-place'), { ...place, id: 'new-place' }));
    await assertSucceeds(updateDoc(doc(database, 'places', place.id), { archived: true }));
    await assertSucceeds(getDoc(doc(database, 'places', 'archived-place')));
  });

  test('clients cannot add themselves to the editor allowlist', async () => {
    const database = environment.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(database, 'editors', 'stranger'), { email: 'stranger@example.com' }));
  });
});
