import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// TODO: Replace the object below with your Firebase project config.
// Get it from: Firebase Console → Project Settings → Your Apps → SDK setup
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAlXNb0eqbwric7evIY-DH3-aWoW6tVz54",
  authDomain: "smartrelief-cff8d.firebaseapp.com",
  projectId: "smartrelief-cff8d",
  storageBucket: "smartrelief-cff8d.firebasestorage.app",
  messagingSenderId: "1017227451498",
  appId: "1:1017227451498:web:6c8646fc3869a496407e13"
};
// ─────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
