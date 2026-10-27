import type { SensorSnapshot } from "../types/sensor";
import { dateTime, measurement } from "../utils/format";
import { Body, Card, Label, Row, StatusBadge } from "./ui";
import { provisionalLabel } from "../services/sensorReading";
export function SensorStatus({ sensor }: { sensor: SensorSnapshot }) {
  return (
    <Card>
      <Label>Moisture sensor</Label>
      <StatusBadge
        label={`${sensor.isMock ? "Simulated · " : ""}${sensor.state}`}
        tone={
          sensor.state === "connected"
            ? "success"
            : sensor.state === "error"
              ? "danger"
              : "neutral"
        }
      />
      <Body>{sensor.device?.name ?? "Connect a sensor before grading."}</Body>
      <Row
        label={sensor.isMock ? "Latest moisture (simulated)" : "Live median ADC"}
        value={
          sensor.isMock
            ? measurement(sensor.moisturePercent, "%")
            : String(sensor.medianAdc ?? "No reading")
        }
      />
      {!sensor.isMock && (
        <Body>
          Sensor status:{" "}
          {sensor.stale
            ? "Reading stale — waiting for update"
            : provisionalLabel(sensor.provisionalStatus)}
          . No exact moisture percentage.
        </Body>
      )}
      <Row
        label="Last updated"
        value={sensor.updatedAt ? dateTime(sensor.updatedAt) : "No reading"}
      />
    </Card>
  );
}
