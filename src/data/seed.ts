import chinaDoll from './places/china-doll.json';
import moonBowl from './places/moon-bowl-ramen.json';
import neoSushi from './places/neo-sushi-bar.json';
import torii from './places/torii-asian-kitchen.json';
import vachach from './places/vachach.json';
import { parsePlaceDocument, toFirestorePlace, type FirestorePlace } from '../domain/firestore-model';

const importedAt = '2026-07-06T00:00:00.000Z';

export const seedPlaces: FirestorePlace[] = [chinaDoll, moonBowl, neoSushi, torii, vachach]
  .map((place) => toFirestorePlace(parsePlaceDocument(place), importedAt));
