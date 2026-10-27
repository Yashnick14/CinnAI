import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { firebaseConfig, firebaseConfigured } from "../config/firebase";
export function firebaseAuth(): Auth {
  if (!firebaseConfigured)
    throw new Error("Firebase configuration is missing.");
  return getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
}
