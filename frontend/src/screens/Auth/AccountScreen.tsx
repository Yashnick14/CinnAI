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
export function AccountScreen() {
  const desktop = useDesktopLayout();
  const { user, updateUsername } = useAuth();
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
          if (active)
            setHistoryError("Your saved assessments could not be loaded.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user?.uid]),
  );
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
      setMessage("Username updated.");
    } catch {
      setError(
        "Could not update your username. Check your connection and try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
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
  const stats = accountSummary(records);
  return (
    <Page>
      <Heading
        title="Your account"
        subtitle="Your profile and grading activity."
      />
      <View
        style={{
          flexDirection: desktop ? "row" : "column",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <Card
          style={{
            flex: desktop ? 1 : undefined,
            width: desktop ? undefined : "100%",
            minWidth: 0,
            gap: 16,
          }}
        >
          <Heading title={user?.displayName || "CinnAI member"} />
          <Body>{user?.email}</Body>
          <Label>Username</Label>
          <TextInput
            accessibilityLabel="Username"
            value={name}
            onChangeText={setName}
            editable={!busy}
            maxLength={80}
            autoCapitalize="words"
            style={{
              padding: 14,
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: 10,
              fontFamily: "Poppins_400Regular",
              color: theme.ink,
            }}
          />
          <Button
            title="Save username"
            onPress={() => void saveName()}
            disabled={busy}
            busy={busy}
          />
          {!!message && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: theme.success }}
            >
              {message}
            </Text>
          )}
          {!!error && <WarningMessage text={error} error />}
          <Button
            title="Sign out"
            secondary
            disabled={busy}
            onPress={() => void logout()}
          />
        </Card>
        <View
          style={{
            flex: desktop ? 2 : undefined,
            width: desktop ? undefined : "100%",
            minWidth: 0,
            gap: 16,
          }}
        >
          <Heading
            title="Your grading dashboard"
            subtitle="Based on your saved assessments on this device."
          />
          {loading ? (
            <Body>Loading your activity…</Body>
          ) : historyError ? (
            <WarningMessage text={historyError} error />
          ) : (
            <>
              <View
                style={{
                  flexDirection: desktop ? "row" : "column",
                  flexWrap: desktop ? "wrap" : "nowrap",
                  gap: 12,
                }}
              >
                {[
                  ["Saved assessments", stats.assessments],
                  ["Quills in graded records", stats.gradedQuills],
                  ["Manual reviews completed", stats.manualReviews],
                  ["Most common grade", stats.common ?? "—"],
                ].map(([label, value]) => (
                  <Card
                    key={label}
                    style={{
                      flexGrow: desktop ? 1 : undefined,
                      flexBasis: desktop ? 180 : undefined,
                      width: desktop ? undefined : "100%",
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
                      value={
                        String(count) + " assessment" + (count === 1 ? "" : "s")
                      }
                    />
                  ))
                ) : (
                  <Body>
                    No saved grades yet. Save an assessment to see your activity
                    here.
                  </Body>
                )}
              </Card>
            </>
          )}
          <Body>
            History belongs to your signed-in account on this device. It is not
            yet synced across devices.
          </Body>
        </View>
      </View>
    </Page>
  );
}
