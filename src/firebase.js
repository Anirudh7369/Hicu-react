// src/firebase.js

import { initializeApp } from "firebase/app";

// Auth (Google Sign-In + session)
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firestore database (real-time messages)
import { getFirestore } from "firebase/firestore";

// Firebase Storage (encrypted media files)
import { getStorage } from "firebase/storage";

// Your Firebase configuration (connects your app to your Firebase project)
const firebaseConfig = {
  apiKey: "AIzaSyDwckVcytDD1wRd1245AR9Wfu33HYnkTtc",
  authDomain: "hicu-eb71e.firebaseapp.com",
  projectId: "hicu-eb71e",
  storageBucket: "hicu-eb71e.firebasestorage.app",
  messagingSenderId: "331484287284",
  appId: "1:331484287284:web:86eab5e85edc15e7e25561",
};

// 1) Initialize the Firebase app (connect your frontend to Firebase project)
const app = initializeApp(firebaseConfig);

// 2) Initialize Auth service (handles login/logout/session)
export const auth = getAuth(app);

// 3) Google provider (needed for signInWithPopup)
export const googleProvider = new GoogleAuthProvider();

// 4) Initialize Firestore DB (stores messages)
export const db = getFirestore(app);

// 5) Initialize Firebase Storage (stores encrypted media)
export const storage = getStorage(app);
