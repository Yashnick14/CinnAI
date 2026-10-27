import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "./firebaseAuth";
import { validateCredentials } from "./authValidation";
export async function requestPasswordReset(email: string) {
  const address = email.trim();
  const problem = validateCredentials(address, "reset");
  if (problem) throw new Error(problem);
  try {
    // Use Firebase's hosted reset handler; no localhost or Expo deep-link redirect.
    await sendPasswordResetEmail(firebaseAuth(), address);
    return address;
  } catch (error) {
    if (__DEV__)
      console.warn(
        "[Password reset] Firebase request failed",
        (error as { code?: string }).code ?? "unknown",
      );
    throw error;
  }
}
