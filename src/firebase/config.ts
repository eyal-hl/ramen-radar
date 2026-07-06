import type { FirebaseOptions } from 'firebase/app';

type PublicEnvironment = Record<string, string | undefined>;

const fields = {
  PUBLIC_FIREBASE_API_KEY: 'apiKey',
  PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
  PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
  PUBLIC_FIREBASE_APP_ID: 'appId',
} as const;

export function readFirebaseConfig(environment: PublicEnvironment): FirebaseOptions {
  const missing = Object.keys(fields).filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Firebase is not configured. Missing: ${missing.join(', ')}`);
  }
  return Object.fromEntries(Object.entries(fields).map(([environmentName, optionName]) => [
    optionName,
    environment[environmentName],
  ]));
}
