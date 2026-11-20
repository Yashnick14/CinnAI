import { requestPasswordReset } from "../../services/passwordReset";
import { useDesktopLayout } from "../../hooks/useDesktopLayout";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, TextInput } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { firebaseAuth } from "../../services/firebaseAuth";
import { authError } from "../../services/authValidation";
import {
  Body,
  Button,
  Card,
  Heading,
  Label,
  Page,
  Row,
  WarningMessage,
} from "../../components/ui";
import { Text } from "../../components/AppText";
import { theme } from "../../config/theme";
import { history } from "../../storage/history";
import { accountSummary } from "../../utils/accountSummary";
import type { GradingResult } from "../../types/grading";

/** Present the signed-in profile and grading activity summary. */
export function AccountScreen() {
  const desktop = useDesktopLayout();
  const { user, updateUsername } = useAuth();
  const [editing, setEditing] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [records, setRecords] = useState<GradingResult[]>([]),
    [loading, setLoading] = useState(true),
    [historyError, setHistoryError] = useState("");
  const lock = useRef(false);
  useEffect(() => setName(user?.displayName ?? ""), [user?.displayName]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setHistoryError("");
      setRecords([]);
      history
        .list()
        .then((value) => {
          if (active) setRecords(value);
        })
        .catch(() => {
          if (active) setHistoryError("Your saved assessments could not be loaded.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user?.uid]),
  );

  /** Save the edited display name and report validation or account errors. */
  async function saveName() {
    if (lock.current) return;
    const value = name.trim();
    if (!value || value.length > 80) {
      setError("Use a username between 1 and 80 characters.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateUsername(value);
      setMessage("Profile updated.");
      setEditing(false);
    } catch {
      setError("Could not update your username. Check your connection and try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  /** Sign out and clear the account-dependent UI state. */
  async function logout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await signOut(firebaseAuth());
    } catch (e) {
      setError(authError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  /** Send a password reset only when requested for the signed-in password account. */
  async function resetPassword() {
    if (lock.current || !user?.email || resetSent) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await requestPasswordReset(user.email);
      setResetSent(true);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (e) {
      setError(authError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const passwordAccount = user?.providerData.some(
    (provider) => provider.providerId === "password",
  );
  const googleAccount = user?.providerData.some(
    (provider) => provider.providerId === "google.com",
  );
  const initials = (user?.displayName || user?.email || "C")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const created = user?.metadata.creationTime;
  const memberSince =
    created && Number.isFinite(Date.parse(created))
      ? new Date(created).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })
      : "—";
  const stats = accountSummary(records);
  return (
    <Page>
      <Heading
        title="My account"
        subtitle="Manage your profile and account security."
      />
      <View
        style={{
          flexDirection: desktop ? "row" : "column",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <View
          style={{
            flex: desktop ? 1 : undefined,
            width: desktop ? undefined : "100%",
            minWidth: 0,
            gap: 16,
          }}
        >
          <Card style={{ gap: 18, padding: 22 }}>
            <View style={{ alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: theme.creamDeep,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: theme.line,
                }}
              >
                <Text style={{ fontSize: 26, fontWeight: "700", color: theme.primary }}>
                  {initials}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: theme.ink,
                  textAlign: "center",
                }}
              >
                {user?.displayName || "CinnAI member"}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12, textAlign: "center" }}>
                {user?.email}
              </Text>
            </View>
            <Row label="Member since" value={memberSince} />
            <Button
              title={editing ? "Editing profile" : "Edit profile"}
              secondary
              disabled={busy || editing}
              onPress={() => {
                setName(user?.displayName ?? "");
                setEditing(true);
                setError("");
                setMessage("");
              }}
            />
          </Card>
          {editing && (
            <Card style={{ gap: 14 }}>
              <Label>Edit profile</Label>
              <Body>Choose the name shown on your account.</Body>
              <Label>Display name</Label>
              <TextInput
                accessibilityLabel="Display name"
                value={name}
                onChangeText={setName}
                editable={!busy}
                maxLength={80}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.line,
                  backgroundColor: theme.paper,
                  fontFamily: "Poppins_400Regular",
                  color: theme.ink,
                }}
              />
              <Button
                title="Save changes"
                onPress={() => void saveName()}
                disabled={busy || name.trim() === (user?.displayName ?? "")}
                busy={busy}
              />
              <Button
                title="Cancel"
                secondary
                disabled={busy}
                onPress={() => {
                  setEditing(false);
                  setName(user?.displayName ?? "");
                  setError("");
                }}
              />
            </Card>
          )}
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={{ color: theme.success }}>
              {message}
            </Text>
          )}
          {!!error && <WarningMessage text={error} error />}
          <Card style={{ gap: 14 }}>
            <Label>Account & security</Label>
            <Row label="Email address" value={user?.email ?? "—"} />
            <Row
              label="Sign-in method"
              value={
                passwordAccount && googleAccount
                  ? "Google & password"
                  : googleAccount
                    ? "Google"
                    : "Email & password"
              }
            />
            <Row
              label="Email status"
              value={user?.emailVerified ? "Verified" : "Not verified"}
            />
            {passwordAccount ? (
              <Button
                title={resetSent ? "Reset email sent" : "Reset password"}
                secondary
                disabled={busy || resetSent}
                onPress={() => void resetPassword()}
              />
            ) : (
              <Body>Your password is managed through your Google account.</Body>
            )}
          </Card>
          <Card style={{ gap: 12 }}>
            <Label>Session</Label>
            <Button
              title="Sign out"
              secondary
              color={theme.danger}
              disabled={busy}
              onPress={() => void logout()}
            />
          </Card>
        </View>
        <View
          style={{
            flex: desktop ? 2 : undefined,
            width: desktop ? undefined : "100%",
            minWidth: 0,
            gap: 16,
          }}
        >
          <Heading title="Grading activity" />
          {loading ? (
            <Body>Loading your activity…</Body>
          ) : historyError ? (
            <WarningMessage text={historyError} error />
          ) : (
            <>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                {[
                  ["Saved assessments", stats.assessments],
                  ["Graded quills", stats.gradedQuills],
                  ["Manual reviews", stats.manualReviews],
                  ["Most common grade", stats.common ?? "—"],
                ].map(([label, value]) => (
                  <Card
                    key={label}
                    style={{
                      flexGrow: 1,
                      flexBasis: desktop ? 180 : "45%",
                      minWidth: 0,
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 26,
                        fontWeight: "700",
                        color: theme.primary,
                      }}
                    >
                      {value}
                    </Text>
                    <Body>{label}</Body>
                  </Card>
                ))}
              </View>
              <Card style={{ gap: 12 }}>
                <Label>Grade distribution</Label>
                {stats.grades.length ? (
                  stats.grades.map(([grade, count]) => (
                    <Row
                      key={grade}
                      label={grade}
                      value={String(count) + " assessment" + (count === 1 ? "" : "s")}
                    />
                  ))
                ) : (
                  <Body>
                    No saved grades yet. Save an assessment to see your activity here.
                  </Body>
                )}
              </Card>
            </>
          )}
        </View>
      </View>
    </Page>
  );
}
