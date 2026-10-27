import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Persistence,
  type Auth,
} from "firebase/auth";
import { firebaseConfig, firebaseConfigured } from "../config/firebase";
// Metro selects Firebase's react-native export; TypeScript resolves the web types.
const { getReactNativePersistence } = require("firebase/auth") as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};
let instance: Auth | undefined;
export function firebaseAuth(): Auth {
  if (!firebaseConfigured)
    throw new Error("Firebase configuration is missing.");
  if (instance) return instance;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  try {
    instance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/already-initialized")
      throw error;
    instance = getAuth(app);
  }
  return instance;
}
