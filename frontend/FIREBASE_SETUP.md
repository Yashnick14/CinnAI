# CinnAI account setup

The existing profile icon opens account access. Email/password registration, login, password reset, persistent Firebase sessions and sign-out are implemented. Login is the initial route for signed-out users. Protected app routes are only mounted after Firebase restores or establishes a signed-in session. Signing out discards the protected navigation stack. Authentication does not protect the FastAPI endpoints; backend token verification is a separate task. Assessment history is device-local and keyed by Firebase UID. Only the signed-in user can list, look up, save or delete records through the app repository. Old shared records remain preserved at the legacy key, unassigned and hidden because their owner cannot be inferred. There is no cross-device cloud sync.

## Firebase Console
1. Open CinnAI > Project settings > General > Your apps. Register a Web app and copy its SDK configuration (even for Expo Go).
2. Add the four EXPO_PUBLIC_FIREBASE_* variables from .env.example to your existing .env. Do not replace your existing sensor/backend settings. Public Firebase client configuration is expected here; never add service-account credentials or OAuth client secrets.
3. Authentication > Get started > Sign-in method: enable Email/Password and Google. Select the support email.
4. Authentication > Settings > Authorized domains: add the web app hostname (including localhost for local web testing if absent). Google browser sign-in needs a supported secure origin; deploy HTTPS for phone browser use.
5. Restart Expo with `npx expo start --go --clear`. Use Profile > Sign in / Register. Test registration, sign-out, login, restart persistence and password reset with your own email.

## Google on web and native
Web uses Firebase signInWithPopup. Allow the popup and choose a Google account.
Expo Go does NOT support native Google sign-in: the button explains this; email/password remains available.
For a development build, register the iOS/Android apps in Firebase with the identifiers in app.config.ts. Configure Google OAuth clients, Android signing fingerprints, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME (reversed iOS client ID). The config plugin is enabled when that scheme is supplied. Build a fresh native app; a Metro reload cannot add the native module. iPhone signing requirements still apply.

## Verification limits
Automated tests mock Firebase and cover validation, error handling, app reuse and Google popup dispatch. Live authentication requires your Firebase configuration and enabled providers. No account has been created automatically. Grading, RF, diameter, moisture and backend routes are unchanged.

## Password reset delivery
The app awaits Firebase sendPasswordResetEmail using the trimmed entered address and the default Firebase-hosted reset page. A successful response acknowledges the request, not delivery. Email enumeration protection can suppress mail for nonexistent accounts without throwing an error.
If no email arrives, verify the address exists in this project's Authentication > Users, check spam, and inspect Authentication > Templates > Password reset (sender, action URL and any custom SMTP). Do not disable enumeration protection to diagnose delivery. App error messages report network/provider/quota problems; development logging records only the Firebase error code, never the address or password. Inbox delivery must be verified with a real account.

Account username editing updates the Firebase displayName (not a unique login identifier). Dashboard counts reflect saved assessment records, not all analyses or distinct physical quills.
