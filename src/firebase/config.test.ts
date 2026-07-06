import { describe, expect, test } from 'vitest';
import { readFirebaseConfig } from './config';

describe('Firebase configuration', () => {
  test('returns a complete public web configuration', () => {
    expect(readFirebaseConfig({
      PUBLIC_FIREBASE_API_KEY: 'public-key',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'ramen.firebaseapp.com',
      PUBLIC_FIREBASE_PROJECT_ID: 'ramen',
      PUBLIC_FIREBASE_APP_ID: 'app-id',
    })).toEqual({
      apiKey: 'public-key',
      authDomain: 'ramen.firebaseapp.com',
      projectId: 'ramen',
      appId: 'app-id',
    });
  });

  test('reports a useful error when configuration is incomplete', () => {
    expect(() => readFirebaseConfig({ PUBLIC_FIREBASE_PROJECT_ID: 'ramen' }))
      .toThrow('PUBLIC_FIREBASE_API_KEY');
  });
});
