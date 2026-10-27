import {} from "react-native";
import { Text } from "./AppText";
import { Card, Label, Row } from "./ui";
import type { SampleResult } from "../types/decision";

export function DetectorComparison({
  comparison,
}: {
  comparison: SampleResult["debug_comparison"];
}) {
  if (!comparison) return null;
  const legacy = comparison.legacy_detector;
  const segmentation = comparison.segmentation_model;
  const confidence = (value: number | null) =>
    value === null ? "—" : `${(value * 100).toFixed(1)}%`;
  return (
    <Card>
      <Label>Temporary debug comparison</Label>
      <Text>Same uploaded photo · detection evidence only, not a grade</Text>
      <Label>Legacy Quill Detector</Label>
      {legacy ? (
        <>
          <Row
            label="Quill detected"
            value={legacy.quill_detected ? "Yes" : "No"}
          />
          <Row label="Confidence" value={confidence(legacy.max_confidence)} />
        </>
      ) : (
        <Text>Detector unavailable</Text>
      )}
      <Label>Coin + Quill Segmentation Model</Label>
      {segmentation ? (
        <>
          <Row
            label="Coin detected"
            value={segmentation.coin_detected ? "Yes" : "No"}
          />
          <Row
            label="Coin confidence"
            value={confidence(segmentation.coin_confidence)}
          />
          <Row
            label="Quill detected"
            value={segmentation.quill_detected ? "Yes" : "No"}
          />
          <Row
            label="Quill confidence"
            value={confidence(segmentation.quill_confidence)}
          />
          <Row
            label="Detections (coin / quill)"
            value={`${segmentation.coin_detection_count} / ${segmentation.quill_detection_count}`}
          />
          <Row
            label="Segmentation masks available"
            value={segmentation.segmentation_available ? "Yes" : "No"}
          />
        </>
      ) : (
        <Text>Segmentation comparison unavailable</Text>
      )}
    </Card>
  );
}
