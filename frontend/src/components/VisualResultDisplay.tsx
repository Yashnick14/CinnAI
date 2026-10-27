import {} from "react-native";
import { Text } from "./AppText";
import type { VisualResult } from "../types/visual";
import { SUPPORTED_GRADES } from "../config/grading";
import { theme } from "../config/theme";
import { Body, Card, Label, Row, StatusBadge } from "./ui";
import { ConfidenceRing } from "./ConfidenceRing";
import { ConfidenceDisplay } from "./ConfidenceDisplay";

export function VisualResultDisplay({ result }: { result: VisualResult }) {
  return (
    <>
      <Card
        style={{
          backgroundColor: theme.cream,
          alignItems: "center",
          paddingVertical: 22,
          gap: 12,
        }}
      >
        <StatusBadge label="Visual prediction complete" tone="success" />
        <ConfidenceRing
          value={result.visualConfidence}
          label="VISUAL CONFIDENCE"
        />
        <Text
          style={{
            fontSize: 36,
            textAlign: "center",
            fontFamily: theme.serif,
            fontWeight: "700",
            color: theme.primary,
          }}
        >
          {result.visualPrediction}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 9, letterSpacing: 0.5 }}>
          YOLO11n + RANDOM FOREST · VISUAL MODEL
        </Text>
      </Card>
      <Card>
        <Label>Visual Analysis</Label>
        <Row label="Detected quills" value={String(result.detectedQuills)} />
        <Row label="Visual prediction" value={result.visualPrediction} />
        <ConfidenceDisplay
          label="Visual confidence"
          value={result.visualConfidence}
        />
        <Body>
          The detected count includes all returned YOLO boxes and may include
          overlapping detections. Confidence is the model probability, not a
          validated accuracy score.
        </Body>
      </Card>
      <Card>
        <Label>Grade Probabilities</Label>
        {SUPPORTED_GRADES.map((grade) => (
          <ConfidenceDisplay
            key={grade}
            label={grade}
            value={result.probabilities[grade]}
          />
        ))}
      </Card>
    </>
  );
}
