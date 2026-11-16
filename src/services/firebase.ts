import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let db: Firestore;
try {
  // Use memoryLocalCache to avoid multi-tab IndexedDB lease deadlocks across iframes/tabs,
  // and experimentalAutoDetectLongPolling for fast HTTP/2 WebChannel with proxy fallback.
  db = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true,
      localCache: memoryLocalCache(),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export { db };
export const auth = getAuth(app);

// Guarantee persistent login: closing Chrome or website will NEVER log the user out
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Persistence configuration notice:', err);
});
