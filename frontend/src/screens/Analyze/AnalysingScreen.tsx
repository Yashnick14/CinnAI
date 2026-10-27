import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../../components/AppText";
import { validateSample } from "../../services/sampleApi";
import type { SampleResult } from "../../types/decision";
import type { ScreenProps } from "../../types/navigation";
import { Button, Card, Heading, Page, WarningMessage } from "../../components/ui";
import { CapturedPhoto } from "../../components/CapturedPhoto";
import { DetectorComparison } from "../../components/DetectorComparison";
import { SessionMoistureCard } from "../../components/SessionMoistureCard";
import { theme } from "../../config/theme";
import { errorMessage } from "../../utils/format";
import type { ValidationProgress } from "../../services/validationStream";

export function AnalysingScreen({
  navigation,
  route,
}: ScreenProps<"Analysing">) {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SampleResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<
    Partial<Record<ValidationProgress["step"], ValidationProgress["state"]>>
  >({});
  const waiting = !result && !error;
  useEffect(() => {
    const controller = new AbortController();
    const start = Date.now();
    setError(null);
    setResult(null);
    setElapsed(0);
    setProgress({});
    const timer = setInterval(
      () => setElapsed((Date.now() - start) / 1000),
      200,
    );
    validateSample(route.params, controller.signal, (event) => {
      if (!controller.signal.aborted)
        setProgress((previous) => ({ ...previous, [event.step]: event.state }));
    })
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => clearInterval(timer));
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [attempt, route.params]);
  const retry = () => {
    setResult(null);
    setError(null);
    setProgress({});
    setAttempt((value) => value + 1);
  };
  return (
    <Page>
      <Heading
        title="Analysing Sample"
        subtitle="Checking your sample before assigning a grade"
      />
      <CapturedPhoto uri={route.params.imageUri} height={185} />
      <Card>
        <Text style={s.cardTitle}>Sample validation checks</Text>
        {(
          [
            ["detector", "Quill detection"],
            ["visual", "Visual feature analysis"],
            ["diameter", "Coin & quill segmentation / diameter"],
            ["decision", "Sample validation"],
          ] as const
        ).map(([id, label], index) => {
          const recorded = progress[id];
          const state =
            error && (!recorded || recorded === "running")
              ? "unavailable"
              : (recorded ?? "pending");
          const step = {
            label,
            state,
            detail:
              state === "running"
                ? "Processing…"
                : state === "passed"
                  ? "Check completed"
                  : state === "failed"
                    ? "Check not passed. Recapture or request review."
                    : state === "unavailable"
                      ? "Check could not complete. Please retry."
                      : "Waiting for previous checks",
          };
          const color =
            step.state === "passed"
              ? theme.success
              : step.state === "failed"
                ? theme.danger
                : theme.muted;
          return (
            <View
              key={step.label}
              style={s.row}
              accessible
              accessibilityLabel={`${step.label}: ${step.state}. ${step.detail}`}
            >
              <View
                style={[
                  s.marker,
                  {
                    backgroundColor:
                      step.state === "passed"
                        ? theme.successBg
                        : step.state === "failed"
                          ? theme.dangerBg
                          : theme.cream,
                  },
                ]}
              >
                {step.state === "running" ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={{ color, fontWeight: "700" }}>
                    {step.state === "passed"
                      ? "✓"
                      : step.state === "failed"
                        ? "×"
                        : step.state === "unavailable"
                          ? "—"
                          : index + 1}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{step.label}</Text>
                <Text style={s.detail}>{step.detail}</Text>
              </View>
            </View>
          );
        })}
      </Card>
      <View style={s.status} accessibilityLiveRegion="polite">
        {waiting && <ActivityIndicator size="small" color={theme.primary} />}
        <Text style={s.statusText}>
          {waiting
            ? "Uploading & checking sample…"
            : result?.status === "VALID"
              ? "Checks complete"
              : "Analysis needs attention"}
        </Text>
        <Text style={s.detail}>{elapsed.toFixed(1)}s</Text>
      </View>
      {waiting && (
        <Text style={s.detail}>
          Each check updates as the backend completes it. Coin segmentation and
          diameter run together.
        </Text>
      )}
      {error && <WarningMessage text={error} error />}
      <SessionMoistureCard reading={route.params.moisture} />
      {result && <DetectorComparison comparison={result.debug_comparison} />}
      {result && result.status !== "VALID" && (
        <WarningMessage text="No grade assigned. Review the checks above, then recapture or request manual review." />
      )}
      {result && (
        <Button
          title={
            result.status === "VALID"
              ? "View Validated Result"
              : "View Assessment"
          }
          onPress={() => navigation.replace("Result", { result })}
        />
      )}
      {!waiting && result?.status !== "VALID" && (
        <Button title="Retry Analysis" onPress={retry} />
      )}
      <Button
        title={waiting ? "Cancel & Retake Photo" : "Retake Photo"}
        secondary
        onPress={() => navigation.popTo("Camera")}
      />
    </Page>
  );
}
const s = StyleSheet.create({
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.ink,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "600", color: theme.ink },
  detail: { fontSize: 12, color: theme.muted, lineHeight: 18 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.cream,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: theme.primary,
  },
});
