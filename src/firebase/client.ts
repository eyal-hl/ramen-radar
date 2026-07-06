import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { readFirebaseConfig } from './config';

export function getFirebaseServices() {
  const app = getApps().length > 0
    ? getApp()
    : initializeApp(readFirebaseConfig(import.meta.env));
  return {
    app,
    auth: getAuth(app),
    database: getFirestore(app),
  };
}
