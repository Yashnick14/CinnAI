import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth } from "./firebaseAuth";

export const googleUnavailableReason: string | null = null;

/** Authenticate through the platform-specific Google sign-in flow. */
export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(firebaseAuth(), provider);
}
