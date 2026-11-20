import type { SensorSnapshot } from "../types/sensor";
import { dateTime, measurement } from "../utils/format";
import { Body, Card, Label, Row, StatusBadge } from "./ui";
import { provisionalLabel } from "../services/sensorReading";

/** Display the current sensor connection and reading state. */
export function SensorStatus({ sensor }: { sensor: SensorSnapshot }) {
  return (
    <Card>
      <Label>Moisture sensor</Label>
      <StatusBadge
        label={`${sensor.isMock ? "Sample data · " : ""}${sensor.state}`}
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
        label={sensor.isMock ? "Sample moisture" : "Live median ADC"}
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
            : provisionalLabel(sensor.provisionalStatus, sensor.medianAdc)}
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
