import Constants from "expo-constants";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { googleWebClientId, googleIosClientId } from "../config/firebase";
import { firebaseAuth } from "./firebaseAuth";
export const googleUnavailableReason =
  Constants.appOwnership === "expo"
    ? "Google sign-in requires a development build. In Expo Go, use email and password."
    : !googleWebClientId || !googleIosClientId
      ? "Google sign-in is awaiting OAuth client configuration."
      : null;
export async function signInGoogle() {
  if (googleUnavailableReason) throw new Error(googleUnavailableReason);
  // Only load the native module in a development/production build, never Expo Go.
  const { GoogleSignin } =
    require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
  });
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  if (result.type !== "success" || !result.data.idToken)
    throw { code: "auth/popup-closed-by-user" };
  await signInWithCredential(
    firebaseAuth(),
    GoogleAuthProvider.credential(result.data.idToken),
  );
}
