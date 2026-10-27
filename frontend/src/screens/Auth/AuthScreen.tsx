import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { BrandLogo } from "../../components/BrandLogo";
import { HeroPhoto } from "../../components/HeroPhoto";
import { GoogleIcon } from "../../components/GoogleIcon";
import { Text } from "../../components/AppText";
import { theme } from "../../config/theme";
import { firebaseConfigured } from "../../config/firebase";
import { firebaseAuth } from "../../services/firebaseAuth";
import { googleUnavailableReason, signInGoogle } from "../../services/googleAuth";
import { authError, validateCredentials } from "../../services/authValidation";
import { requestPasswordReset } from "../../services/passwordReset";
import { useAuth } from "../../context/AuthContext";
import type { ScreenProps } from "../../types/navigation";
export function AuthScreen({
  navigation,
  route,
}: ScreenProps<"Login" | "Register" | "ForgotPassword">) {
  const registering = route.name === "Register",
    resetting = route.name === "ForgotPassword";
  const wide = useWindowDimensions().width >= 900;
  const { loading, error: sessionError } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? ""),
    [password, setPassword] = useState("");
  const [name, setName] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [sentTo, setSentTo] = useState("");
  const lock = useRef(false);
  async function perform(google = false) {
    if (lock.current) return;
    setError("");
    setSentTo("");
    if (!firebaseConfigured) {
      setError(
        "Firebase configuration is missing. Please complete account setup.",
      );
      return;
    }
    if (!google) {
      const problem = validateCredentials(
        email,
        resetting ? "reset" : password,
        registering,
        name,
        confirmation,
      );
      if (problem) {
        setError(problem);
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    try {
      if (google) await signInGoogle();
      else if (resetting) setSentTo(await requestPasswordReset(email));
      else if (registering) {
        const result = await createUserWithEmailAndPassword(
          firebaseAuth(),
          email.trim(),
          password,
        );
        await updateProfile(result.user, { displayName: name.trim() });
      } else
        await signInWithEmailAndPassword(
          firebaseAuth(),
          email.trim(),
          password,
        );
      // Firebase's auth observer switches the navigator to Home. Never navigate across auth stacks.
    } catch (e) {
      setError(authError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function link(label: string, action: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={action}
        style={({ pressed }) => [
          { paddingVertical: 8, opacity: pressed || busy ? 0.6 : 1 },
        ]}
      >
        <Text style={s.link}>{label}</Text>
      </Pressable>
    );
  }
  function field(
    label: string,
    value: string,
    change: (text: string) => void,
    secret = false,
  ) {
    return (
      <View style={{ gap: 7 }}>
        <Text style={s.label}>{label}</Text>
        <View style={s.inputWrap}>
          <TextInput
            accessibilityLabel={label}
            value={value}
            onChangeText={change}
            editable={!busy}
            secureTextEntry={secret && !visible}
            autoCapitalize={label === "Full name" ? "words" : "none"}
            autoCorrect={false}
            keyboardType={
              label === "Email address" ? "email-address" : "default"
            }
            autoComplete={
              label === "Email address"
                ? "email"
                : label === "Full name"
                  ? "name"
                  : registering
                    ? "new-password"
                    : "current-password"
            }
            style={s.input}
          />
          {secret && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? "Hide password" : "Show password"}
              disabled={busy}
              onPress={() => setVisible(!visible)}
              style={s.show}
            >
              <Text style={s.link}>{visible ? "Hide" : "Show"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }
  const disabled = busy || loading || !firebaseConfigured;
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.scroll, { padding: wide ? 40 : 20 }]}
        >
          <View style={[s.shell, { flexDirection: wide ? "row" : "column" }]}>
            {wide && (
              <HeroPhoto style={{ flex: 1, minHeight: 650 }}>
                <View style={s.photoShade}>
                  <Text style={s.eyebrow}>CINNAMON. WITH CONFIDENCE.</Text>
                  <View>
                    <Text style={s.story}>Every quill has a story.</Text>
                    <Text style={s.storySub}>Start with the evidence.</Text>
                  </View>
                  <Text style={s.photoFoot}>CinnAI · Cinnamon grading</Text>
                </View>
              </HeroPhoto>
            )}
            <View style={[s.formPanel, { padding: wide ? 48 : 24 }]}>
              <View style={s.form}>
                <View style={{ alignItems: "center" }}>
                  <BrandLogo width={170} />
                </View>
                <View style={{ gap: 8, marginTop: 12, marginBottom: 10 }}>
                  <Text
                    accessibilityRole="header"
                    style={[s.title, { textAlign: "center" }]}
                  >
                    {registering
                      ? "Create an account"
                      : resetting
                        ? "Forgot your password?"
                        : "Welcome"}
                  </Text>
                  <Text style={[s.sub, { textAlign: "center" }]}>
                    {registering
                      ? "Start your cinnamon assessment journey."
                      : resetting
                        ? "Enter the email address you used to register."
                        : "Sign in to continue to CinnAI."}
                  </Text>
                </View>
                {!firebaseConfigured && (
                  <Text style={s.error}>
                    Firebase account setup is pending.
                  </Text>
                )}
                {registering && field("Full name", name, setName)}
                {field("Email address", email, setEmail)}
                {!resetting && field("Password", password, setPassword, true)}
                {registering && (
                  <>
                    <Text style={s.hint}>Use at least 8 characters.</Text>
                    {field(
                      "Confirm password",
                      confirmation,
                      setConfirmation,
                      true,
                    )}
                  </>
                )}
                {!registering && !resetting && (
                  <View style={{ alignItems: "flex-end" }}>
                    {link("Forgot password?", () =>
                      navigation.navigate("ForgotPassword", {
                        email: email.trim(),
                      }),
                    )}
                  </View>
                )}
                {!!(error || sessionError) && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {error || sessionError}
                  </Text>
                )}
                {!!sentTo && (
                  <View accessibilityLiveRegion="polite" style={s.notice}>
                    <Text style={s.label}>Reset request accepted</Text>
                    <Text style={s.sub}>
                      If an account exists for {sentTo}, Firebase will send a
                      reset link. Check your inbox and spam folder. Delivery is
                      not confirmed by the app.
                    </Text>
                    <Text style={s.hint}>
                      No email? Check the address above or try again after a few
                      minutes.
                    </Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  accessibilityState={{ disabled, busy }}
                  onPress={() => void perform()}
                  style={({ pressed }) => [
                    s.primary,
                    { opacity: disabled ? 0.55 : pressed ? 0.85 : 1 },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={s.primaryText}>
                      {registering
                        ? "Create account"
                        : resetting
                          ? sentTo
                            ? "Send again"
                            : "Send reset link"
                          : "Sign in"}
                    </Text>
                  )}
                </Pressable>
                {!resetting && (
                  <>
                    <View style={s.divider}>
                      <View style={s.line} />
                      <Text style={s.hint}>or</Text>
                      <View style={s.line} />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Continue with Google"
                      disabled={disabled || !!googleUnavailableReason}
                      accessibilityState={{
                        disabled: disabled || !!googleUnavailableReason,
                      }}
                      onPress={() => void perform(true)}
                      style={({ pressed }) => [
                        s.google,
                        {
                          opacity:
                            disabled || googleUnavailableReason
                              ? 0.6
                              : pressed
                                ? 0.8
                                : 1,
                        },
                      ]}
                    >
                      <GoogleIcon />
                      <Text style={s.googleText}>Continue with Google</Text>
                    </Pressable>
                    {!!googleUnavailableReason && (
                      <Text style={s.hint}>{googleUnavailableReason}</Text>
                    )}
                  </>
                )}
                <View style={s.footer}>
                  <Text style={[s.sub, { textAlign: "center" }]}>
                    {registering
                      ? "Already have an account?"
                      : resetting
                        ? "Remember your password?"
                        : "New to CinnAI?"}
                  </Text>
                  {link(
                    registering || resetting ? "Sign in" : "Create an account",
                    () =>
                      navigation.replace(
                        registering || resetting ? "Login" : "Register",
                      ),
                  )}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.creamDeep },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  shell: {
    width: "100%",
    maxWidth: 1120,
    backgroundColor: theme.paper,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.line,
  },
  formPanel: { flex: 1, justifyContent: "center" },
  form: { width: "100%", maxWidth: 420, alignSelf: "center", gap: 15 },
  title: { fontSize: 29, fontWeight: "700", color: theme.ink },
  sub: { fontSize: 13, color: theme.inkSoft, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: "600", color: theme.ink },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9CDBF",
    borderRadius: 10,
    backgroundColor: theme.background,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    fontSize: 15,
    color: theme.ink,
    fontFamily: "Poppins_400Regular",
  },
  show: { padding: 12 },
  link: { fontSize: 13, fontWeight: "600", color: theme.primary },
  hint: { fontSize: 12, lineHeight: 19, color: theme.inkSoft },
  primary: {
    minHeight: 52,
    backgroundColor: theme.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  primaryText: { color: "white", fontWeight: "600", fontSize: 15 },
  google: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D9CDBF",
    borderRadius: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  googleText: { color: theme.ink, fontSize: 14, fontWeight: "500" },
  divider: { flexDirection: "row", gap: 16, alignItems: "center" },
  line: { height: 1, backgroundColor: theme.line, flex: 1 },
  footer: { alignItems: "center", marginTop: 8, gap: 2 },
  error: {
    color: theme.danger,
    backgroundColor: theme.dangerBg,
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 21,
  },
  notice: {
    backgroundColor: theme.cream,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  photoShade: {
    flex: 1,
    backgroundColor: "rgba(25,14,5,.55)",
    padding: 40,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#F3D5AE",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
  },
  story: { color: "white", fontSize: 40, fontWeight: "700", lineHeight: 52 },
  storySub: { color: "#F3D5AE", fontSize: 24, lineHeight: 36, marginTop: 12 },
  photoFoot: { color: "#F3D5AE", fontSize: 12 },
});
