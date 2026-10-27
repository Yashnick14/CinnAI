import { Body, Card, Label } from "./ui";
import type { SessionMoisture } from "../services/sessionMoisture";

export function SessionMoistureCard({
  reading,
}: {
  reading?: SessionMoisture;
}) {
  return (
    <Card>
      <Label>Moisture · separate quality check</Label>
      <Body>
        {reading?.status === "PASS_PROVISIONAL"
          ? "Likely compliant"
          : reading?.status === "FAIL_PROVISIONAL"
            ? "Likely non-compliant"
            : reading?.status === "DEMO"
              ? "Simulated sensor — no physical compliance result"
              : "Moisture compliance unavailable"}
      </Body>
      <Body>Raw median ADC: {reading?.raw_value ?? "Unavailable"}</Body>
      <Body>
        No calibrated moisture percentage available. Moisture does not change
        the diameter grade.
      </Body>
      {reading && (
        <>
          <Body>
            Source: {reading.source} · Connection at attachment:{" "}
            {reading.connection_state} · Reading: {reading.read_status}
          </Body>
          <Body>Received: {reading.timestamp ?? "No reading"}</Body>
        </>
      )}
    </Card>
  );
}
