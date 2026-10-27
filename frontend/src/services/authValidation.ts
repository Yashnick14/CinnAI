export function validateCredentials(
  email: string,
  password: string,
  registration = false,
  name = "",
  confirmation = "",
) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Enter a valid email address.";
  if (!password) return "Enter your password.";
  if (registration && !name.trim()) return "Enter your name.";
  if (registration && password.length < 8)
    return "Use at least 8 characters for your password.";
  if (registration && password !== confirmation)
    return "Passwords do not match.";
  return null;
}
export function authError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/invalid-email": "Enter a valid email address.",
    "auth/quota-exceeded":
      "Firebase email quota has been reached. Please try again later.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/email-already-in-use":
      "An account already uses this email. Try signing in.",
    "auth/weak-password":
      "Choose a stronger password that meets your account policy.",
    "auth/password-does-not-meet-requirements":
      "Choose a stronger password that meets your account policy.",
    "auth/network-request-failed":
      "Cannot connect. Check your internet connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Allow pop-ups for this site, then try again.",
    "auth/unauthorized-domain":
      "This website domain must be authorized in Firebase Authentication.",
    "auth/operation-not-allowed":
      "Enable this sign-in provider in Firebase Authentication.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/configuration-not-found":
      "Firebase Authentication has not been configured yet.",
    "auth/invalid-api-key": "Check the Firebase web app configuration.",
  };
  return (
    (code && messages[code]) || "Unable to complete sign-in. Please try again."
  );
}
