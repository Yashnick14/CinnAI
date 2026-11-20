import { Card, Label, Row } from "./ui";
import type { SessionMoisture } from "../services/sessionMoisture";
import { measurement } from "../utils/format";

/** Show captured sensor values only when this assessment includes a valid reading. */
export function SessionMoistureCard({ reading }: { reading?: SessionMoisture }) {
  if (
    reading?.raw_value == null ||
    reading.read_status !== "fresh" ||
    (reading.status !== "PASS_PROVISIONAL" && reading.status !== "FAIL_PROVISIONAL")
  )
    return null;

  return (
    <Card>
      <Label>Moisture</Label>
      <Row label="ADC" value={String(reading.raw_value)} />
      <Row label="Moisture percentage" value={measurement(reading.percentage, "%")} />
    </Card>
  );
}
