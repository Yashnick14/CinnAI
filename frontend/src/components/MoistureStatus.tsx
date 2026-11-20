import type { GradingResult } from "../types/grading";
import { measurement } from "../utils/format";
import { Card, Label, Row, StatusBadge, Body } from "./ui";

/** Present moisture quality separately from the cinnamon grade. */
export function MoistureStatus({ result }: { result: GradingResult }) {
  return (
    <Card>
      <Label>Moisture compliance</Label>
      <Row label="Moisture" value={measurement(result.moisturePercent, "%")} />
      <StatusBadge
        label={result.moistureStatus}
        tone={
          result.moistureStatus === "PASS"
            ? "success"
            : result.moistureStatus === "FAIL"
              ? "danger"
              : "warning"
        }
      />
      <Body>
        ADC-based moisture screening does not select the diameter grade or measure
        moisture percentage.
      </Body>
    </Card>
  );
}
