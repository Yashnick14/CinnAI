import { useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { Text } from "./AppText";
import { Body, Button, Card, Label, WarningMessage } from "./ui";
import { theme } from "../config/theme";
import { useAuth } from "../context/AuthContext";
import { firebaseAuth } from "../services/firebaseAuth";
import { adminReportRecords } from "../services/adminReports";
import {
  reportRange,
  formatReportDateInput,
  qualityReportHtml,
  summarizeQuality,
  type ReportPeriod,
} from "../services/qualityReport";
import { prepareReportExport } from "../services/exportQualityReport";
import type { GradingResult } from "../types/grading";
import { errorMessage } from "../utils/format";

/** Export a freshly fetched account report independently of history search filters. */
export function QualityReportExport({
  records,
  loading,
  unavailable,
  reportUser = "",
  reportLabel,
}: {
  records: GradingResult[];
  loading: boolean;
  unavailable: boolean;
  reportUser?: string;
  reportLabel?: string;
}) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  let reportMessage = "";
  if (!loading && !unavailable) {
    try {
      const now = new Date();
      if (
        !summarizeQuality(records, reportRange(period, now, from, to), now).assessments
      )
        reportMessage = "No records found";
    } catch (e) {
      reportMessage = errorMessage(e);
    }
  }
  async function generate() {
    if (lock.current || loading || unavailable || reportMessage) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let destination: ReturnType<typeof prepareReportExport> | undefined;
    try {
      const owner = user?.uid;
      if (!owner || firebaseAuth().currentUser?.uid !== owner)
        throw new Error("Sign in to generate your report.");
      const generatedAt = new Date();
      const range = reportRange(period, generatedAt, from, to);
      destination = prepareReportExport();
      const records = await adminReportRecords(reportUser, owner);
      if (firebaseAuth().currentUser?.uid !== owner)
        throw new Error("Account changed. Please try again.");
      if (!summarizeQuality(records, range, generatedAt).assessments)
        throw new Error("No records found");
      await destination.exportHtml(
        qualityReportHtml(
          records,
          range,
          `${user.displayName || user.email || "Administrator"} � ${reportLabel || "All graders"}`,
          generatedAt,
        ),
      );
    } catch (e) {
      destination?.cancel();
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 14 }}>
      <Label>Quality report</Label>
      <Body>Grade totals and average moisture readings for your selected period.</Body>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {(
          [
            ["day", "Today"],
            ["week", "Last 7 days"],
            ["month", "Last 30 days"],
            ["custom", "Custom"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: period === value, disabled: busy }}
            disabled={busy}
            onPress={() => setPeriod(value)}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 2,
              paddingVertical: 11,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: period === value ? theme.primary : theme.paper,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                textAlign: "center",
                color: period === value ? "white" : theme.primary,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {period === "custom" && (
        <View style={{ gap: 10 }}>
          {(
            [
              ["Start date", from, setFrom],
              ["End date", to, setTo],
            ] as const
          ).map(([label, value, setValue]) => (
            <View key={label} style={{ gap: 5 }}>
              <Body>{label}</Body>
              <TextInput
                accessibilityLabel={label}
                placeholder="YYYY-MM-DD"
                value={value}
                onChangeText={(text) => {
                  setValue(formatReportDateInput(text, value));
                  setError("");
                }}
                keyboardType="number-pad"
                editable={!busy}
                autoCorrect={false}
                maxLength={10}
                style={{
                  borderWidth: 1,
                  borderColor: theme.line,
                  borderRadius: 10,
                  padding: 12,
                  color: theme.ink,
                  fontFamily: "Poppins_400Regular",
                }}
              />
            </View>
          ))}
        </View>
      )}
      {!!error && <WarningMessage text={error} error />}
      {loading || unavailable ? null : reportMessage ? (
        <Text style={{ textAlign: "center", color: theme.muted, width: "100%" }}>
          {reportMessage}
        </Text>
      ) : (
        <Button
          title="Generate PDF report"
          icon="history"
          busy={busy}
          disabled={busy}
          onPress={() => void generate()}
        />
      )}
      {!loading && !unavailable && !reportMessage && Platform.OS === "web" && (
        <Text style={{ textAlign: "center", color: theme.muted }}>
          Choose Save as PDF in the print window.
        </Text>
      )}
    </Card>
  );
}
