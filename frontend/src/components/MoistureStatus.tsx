import type { GradingResult } from "../types/grading";
import { measurement } from "../utils/format";
import { Card, Label, Row, StatusBadge, Body } from "./ui";
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
        Below 14.0% passes. Moisture checks compliance; it does not select the
        grade.
      </Body>
    </Card>
  );
}
