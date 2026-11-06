import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const missing = ['apiKey', 'authDomain', 'projectId', 'appId'].filter((key) => !config[key]);
if (missing.length) throw new Error(`Missing Firebase web configuration: ${missing.join(', ')}`);

const app = initializeApp(config);
export const firebaseAuth = getAuth(app);
export const firebaseAuthReady = setPersistence(firebaseAuth, browserLocalPersistence);
