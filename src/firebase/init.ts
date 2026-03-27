import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

/**
 * Initializes the Firebase Client SDKs.
 * Prioritizes the provided config for reliability in Firebase Studio.
 */
export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    try {
      // Prioritize explicit config for stability
      firebaseApp = initializeApp(firebaseConfig);
    } catch (e) {
      console.warn("Standard initialization failed, attempting parameterless init:", e);
      firebaseApp = initializeApp();
    }

    return getSdks(firebaseApp);
  }

  return getSdks(getApp());
}

/**
 * Returns the primary SDK instances for a given Firebase App.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}
