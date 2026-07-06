import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebaseServices } from './client';

export function observeUser(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseServices().auth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getFirebaseServices().auth, new GoogleAuthProvider());
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseServices().auth);
}
