import { Card, Label, Row } from "./ui";
import type { SessionMoisture } from "../services/sessionMoisture";
import { moistureLabel } from "../utils/moistureLabel";

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
      <Row
        label="Moisture screening"
        value={moistureLabel(reading.status, reading.raw_value)}
      />
    </Card>
  );
}
