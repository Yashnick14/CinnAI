import { moistureLabel } from "../../utils/moistureLabel";
import { useEffect, useState } from "react";
import { ActivityIndicator, Share, View } from "react-native";
import { Text } from "../../components/AppText";
import {
  Body,
  Button,
  Card,
  DemoNotice,
  Heading,
  Page,
  Row,
  StatusBadge,
  WarningMessage,
} from "../../components/ui";
import { cloudRequest } from "../../services/cloudApi";
import { GradingResultSchema } from "../../types/grading";
import { history } from "../../storage/history";
import type { GradingResult } from "../../types/grading";
import type { ScreenProps } from "../../types/navigation";
import { errorMessage, measurement, percent } from "../../utils/format";
import { recordLabel } from "../../utils/historySummary";
import { theme } from "../../config/theme";
import { CapturedPhoto } from "../../components/CapturedPhoto";

/** Display a saved grading record and its available sharing actions. */
export function HistoryDetailScreen({ route }: ScreenProps<"HistoryDetail">) {
  const [result, setResult] = useState<GradingResult>();
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    setResult(undefined);
    setError("");
    const request = route.params.ownerUid
      ? cloudRequest(
          `/admin/history/${encodeURIComponent(route.params.ownerUid)}/${encodeURIComponent(route.params.id)}`,
        ).then((value) => GradingResultSchema.parse(value))
      : history.get(route.params.id);
    request
      .then((r) => {
        if (active) {
          if (r) setResult(r);
          else setError("This saved record could not be found.");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [route.params.id, route.params.ownerUid]);

  /** Share the selected record using the platform share interface. */
  async function share() {
    if (!result) return;
    try {
      await Share.share({
        message: [
          `${result.isMock ? "SIMULATED â€” " : ""}Cinnamon Grading Record #${recordLabel(result.id)}`,
          `Date: ${new Date(result.timestamp).toLocaleString()}`,
          `Grade: ${result.finalGrade ?? "Manual review"}`,
          `Diameter: ${measurement(result.diameterMm, "mm")}`,
          `Moisture: ${moistureLabel(result.moistureStatus, result.moistureRawAdc)}`,
          `Status: ${result.finalStatus.replace(/_/g, " ")}`,
          ...result.warnings.map((w) =>
            w
              .replace(/\bdemo\b/gi, "sample data")
              .replace(/\bprovisional\b/gi, "sensor"),
          ),
        ].join("\n"),
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  /** Group related record details under a section title. */
  const Section = ({
    title,
    children,
    blue = false,
  }: {
    title: string;
    children: React.ReactNode;
    blue?: boolean;
  }) => (
    <Card
      style={
        blue ? { backgroundColor: theme.blueBg, borderColor: "#B9DDF7" } : undefined
      }
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: blue ? theme.blue : theme.primary,
          letterSpacing: 0.3,
        }}
      >
        {title}
      </Text>
      {children}
    </Card>
  );
  return (
    <Page>
      <Heading
        title="Grading Record"
        subtitle={result ? `#${recordLabel(result.id)}` : undefined}
      />
      {error && <WarningMessage text={error} error />}
      {!result && !error && <ActivityIndicator />}
      {result && (
        <>
          {result.isMock && <DemoNotice />}
          <CapturedPhoto uri={result.imageUri} height={200} />
          <StatusBadge
            label={result.finalStatus}
            tone={
              result.finalStatus === "GRADE_ACCEPTED"
                ? "success"
                : result.finalStatus === "MOISTURE_NON_COMPLIANT"
                  ? "danger"
                  : "warning"
            }
          />
          <Section title="SAMPLE INFORMATION">
            <Row label="Sample ID" value={recordLabel(result.id)} />
            <Row
              label="Grading date"
              value={new Date(result.timestamp).toLocaleDateString()}
            />
            <Row
              label="Grading time"
              value={new Date(result.timestamp).toLocaleTimeString()}
            />
          </Section>
          {result.manualReview && (
            <Section title="MANUAL REVIEW">
              <Row label="Grade source" value="Human review" />
              <Row label="Reviewer" value={result.manualReview.reviewer} />
              <Row
                label="Reviewed"
                value={new Date(result.manualReview.reviewedAt).toLocaleString()}
              />
              <Row label="Original status" value={result.manualReview.originalStatus} />
              <Row
                label="Original grade"
                value={result.manualReview.originalGrade ?? "Not assigned"}
              />
              <Row
                label="Diameter grade"
                value={result.manualReview.originalDiameterGrade ?? "Unavailable"}
              />
              <Body>{result.manualReview.reason}</Body>
              <Body>{result.manualReview.notes || "No additional notes."}</Body>
            </Section>
          )}
          <Section title="CLASSIFICATION DETAILS">
            <Row label="Assessed grade" value={result.finalGrade ?? "Manual review"} />
            <Row
              label="Visual prediction"
              value={result.visualPrediction ?? "Unavailable"}
            />
            <Row label="Visual confidence" value={percent(result.visualConfidence)} />
          </Section>
          <Section title="VISUAL & PHYSICAL EVIDENCE">
            <Row
              label="Detected quill count"
              value={String(result.detectedQuillCount)}
            />
            <Row label="Diameter" value={measurement(result.diameterMm, "mm")} />
            <Row
              label="Compatible grades"
              value={result.diameterCandidates.join(", ") || "None"}
            />
          </Section>
          <Section title="MOISTURE SCREENING" blue>
            <Row
              label="Moisture"
              value={moistureLabel(result.moistureStatus, result.moistureRawAdc)}
            />
            <Row
              label="Date"
              value={
                result.moistureCapturedAt
                  ? new Date(result.moistureCapturedAt).toLocaleDateString()
                  : "Unavailable"
              }
            />
            <Row
              label="Time"
              value={
                result.moistureCapturedAt
                  ? new Date(result.moistureCapturedAt).toLocaleTimeString()
                  : "Unavailable"
              }
            />
          </Section>
          {result.warnings
            .filter(
              (w) =>
                !w.startsWith("DEMO ONLY:") &&
                !/sample verified|grade is based on/i.test(w),
            )
            .map((w, i) => (
              <WarningMessage
                key={i}
                text={w
                  .replace(/\bdemo\b/gi, "sample data")
                  .replace(/\bprovisional\b/gi, "sensor")}
              />
            ))}
          <Button
            title={expanded ? "Hide Technical Details" : "Technical Details"}
            secondary
            onPress={() => setExpanded(!expanded)}
          />
          {expanded && (
            <Card>
              {Object.entries(result.visualProbabilities).map(
                ([grade, probability]) => (
                  <Row key={grade} label={grade} value={percent(probability)} />
                ),
              )}
              <Body>Full record ID: {result.id}</Body>
            </Card>
          )}
          <Button title="Share Record" icon="arrow" onPress={() => void share()} />
        </>
      )}
    </Page>
  );
}
