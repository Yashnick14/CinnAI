import { useState } from "react";
import { View } from "react-native";
import { Text } from "./AppText";
import type { GradingResult } from "../types/grading";
import { SUPPORTED_GRADES } from "../config/grading";
import { theme } from "../config/theme";
import { measurement, percent } from "../utils/format";
import {
  Body,
  Button,
  Card,
  DemoNotice,
  Label,
  Row,
  StatusBadge,
  WarningMessage,
} from "./ui";
import { ConfidenceDisplay } from "./ConfidenceDisplay";
import { ConfidenceRing } from "./ConfidenceRing";
import { MoistureStatus } from "./MoistureStatus";
export function GradeResultDisplay({ result }: { result: GradingResult }) {
  const [expanded, setExpanded] = useState(false);
  const tone =
    result.finalStatus === "GRADE_ACCEPTED"
      ? "success"
      : result.finalStatus === "MOISTURE_NON_COMPLIANT"
        ? "danger"
        : "warning";
  return (
    <>
      {result.isMock && <DemoNotice />}
      <Card
        style={{
          backgroundColor: theme.cream,
          alignItems: "center",
          paddingVertical: 22,
          gap: 12,
        }}
      >
        <ConfidenceRing
          value={result.finalCandidateConfidence}
          label="CANDIDATE CONFIDENCE"
        />
        <Text
          style={{
            fontSize: result.finalGrade ? 36 : 27,
            textAlign: "center",
            fontFamily: theme.serif,
            fontWeight: "700",
            color: theme.primary,
          }}
        >
          {result.finalGrade ?? "Manual Review"}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 9, letterSpacing: 0.5 }}>
          {result.isMock
            ? "SIMULATED ASSESSMENT"
            : "HYBRID GRADE ASSESSMENT"}
        </Text>
        <View style={{ alignItems: "center" }}>
          <StatusBadge label={result.finalStatus} tone={tone} />
        </View>
        {result.finalStatus !== "GRADE_ACCEPTED" && result.finalGrade && (
          <Body>
            Grade shown for information. This sample has not been accepted.
          </Body>
        )}
      </Card>
      <Card>
        <Label>Grade Assessment Evidence</Label>
        <ConfidenceDisplay
          label="Visual confidence"
          value={result.visualConfidence}
        />
        <ConfidenceDisplay
          label="Candidate confidence"
          value={result.finalCandidateConfidence}
        />
        <Row
          label="Visual prediction"
          value={result.visualPrediction ?? "Unavailable"}
        />
        <Row label="Diameter" value={measurement(result.diameterMm, "mm")} />
        <Row
          label="Compatible grades"
          value={result.diameterCandidates.join(", ") || "None"}
        />
        <Row
          label="Candidate probability"
          value={
            result.finalGrade
              ? percent(
                  result.candidateProbabilities[result.finalGrade] ?? null,
                )
              : "Unavailable"
          }
        />
        <Row
          label="Detected quills"
          value={String(result.detectedQuillCount)}
        />
      </Card>
      <MoistureStatus result={result} />
      {result.warnings
        .filter((w) => !w.startsWith("DEMO ONLY:"))
        .map((warning, index) => (
          <WarningMessage key={index} text={warning} />
        ))}
      <Button
        title={expanded ? "Hide Technical Details" : "Technical Details"}
        secondary
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <Card>
          <Label>Visual probability distribution</Label>
          {SUPPORTED_GRADES.map((grade) => (
            <Row
              key={grade}
              label={grade}
              value={percent(result.visualProbabilities[grade])}
            />
          ))}
          <Label>Diameter-compatible probabilities</Label>
          {result.diameterCandidates.map((grade) => (
            <Row
              key={grade}
              label={grade}
              value={percent(result.candidateProbabilities[grade] ?? null)}
            />
          ))}
          <Body>
            Candidate confidence is normalized within the compatible set. It is
            not a separately validated accuracy score.
          </Body>
          <Row label="Source" value={result.source} />
          <Row label="Record ID" value={result.id} />
        </Card>
      )}
    </>
  );
}
