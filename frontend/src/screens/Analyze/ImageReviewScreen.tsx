import { useEffect, useRef, useState } from "react";
import type { ScreenProps } from "../../types/navigation";
import {
  Body,
  Card,
  Label,
  Button,
  Heading,
  Page,
  WarningMessage,
} from "../../components/ui";
import { CapturedPhoto } from "../../components/CapturedPhoto";
import { validatePhoto } from "../../storage/photos";
import { errorMessage } from "../../utils/format";
import { randomUUID } from "expo-crypto";
import { sensorService } from "../../services/ble";
import {
  snapshotMoisture,
  type SessionMoisture,
} from "../../services/sessionMoisture";
import { useSensor } from "../../hooks/useSensor";
import {
  advanceMoistureCapture,
  beginMoistureCapture,
  usableCapture,
  moistureQuality,
} from "../../services/moistureCapture";
import { MOISTURE_CAPTURE } from "../../config/moistureCapture";
export function ImageReviewScreen({
  navigation,
  route,
}: ScreenProps<"ImageReview">) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const sensor = useSensor();
  const [capture, setCapture] = useState(() =>
    beginMoistureCapture(sensorService.getSnapshot()),
  );
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (armed)
      setCapture((previous) => advanceMoistureCapture(previous, sensor));
  }, [
    armed,
    sensor.updatedAt,
    sensor.state,
    sensor.error,
    sensor.stale,
    sensor.medianAdc,
  ]);
  const available = usableCapture(capture, sensor);
  const unavailable =
    sensor.state !== "connected" || sensor.stale || !!sensor.error;
  async function analyse(withoutMoisture = false) {
    if (!ready || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const imageUri = await validatePhoto(route.params.imageUri);
      const current = sensorService.getSnapshot();
      if (!withoutMoisture && !usableCapture(capture, current))
        throw new Error(
          "Moisture reading unavailable. Capture a fresh reading before Analyse.",
        );
      const moisture: SessionMoisture = withoutMoisture
        ? {
            ...snapshotMoisture(current),
            raw_value: null,
            timestamp: null,
            status: "UNAVAILABLE",
            read_status: "missing",
          }
        : { ...capture.captured! };
      navigation.replace("Analysing", {
        ...route.params,
        imageUri,
        sessionId: randomUUID(),
        moisture,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        eyebrow="03 / REVIEW"
        title="Check your capture."
        subtitle="Confirm the quills are visible, separated, and sharply focused."
      />
      <CapturedPhoto
        uri={route.params.imageUri}
        height={380}
        onReadyChange={setReady}
      />
      <Card>
        <Label>Capture sample moisture</Label>
        <Body>
          Place the moisture sensor firmly against the cinnamon quill.
        </Body>
        <Body>
          Connection: {sensor.state} · Live ADC:{" "}
          {sensor.medianAdc ?? "Unavailable"}
        </Body>
        <Body>
          {available
            ? `Moisture reading captured — ${moistureQuality(capture.captured!)} (raw sensor). Captured ADC: ${capture.captured!.raw_value}`
            : unavailable
              ? "Moisture reading unavailable"
              : "Waiting for moisture reading..."}
        </Body>
        <Body>
          Confirm sensor placement, then hold it steady for{" "}
          {MOISTURE_CAPTURE.consecutiveReadings} new readings with the same
          sensor status. No calibrated percentage is available.
        </Body>
        {armed && !available && (
          <Body>
            New readings: {capture.count}/{MOISTURE_CAPTURE.consecutiveReadings}
          </Body>
        )}
        <Button
          title={
            armed ? "Recapture moisture" : "Sensor placed — capture reading"
          }
          secondary
          disabled={busy}
          onPress={() => {
            setCapture(beginMoistureCapture(sensorService.getSnapshot()));
            setArmed(true);
          }}
        />
        {sensor.state !== "connected" && (
          <Button
            title="Reconnect sensor"
            secondary
            onPress={() => void sensor.reconnect()}
          />
        )}
      </Card>
      {error && <WarningMessage text={error} error />}
      <Button
        title="Analyse"
        disabled={!ready || !available}
        busy={busy}
        onPress={() => void analyse()}
      />
      {!available && (
        <Button
          title="Analyse without moisture"
          secondary
          disabled={!ready || busy}
          onPress={() => void analyse(true)}
        />
      )}
      {!available && (
        <Body>
          Continuing without moisture reports Export Quality: UNAVAILABLE.
        </Body>
      )}
      <Button
        title="Retake"
        secondary
        disabled={busy}
        onPress={() => navigation.goBack()}
      />
    </Page>
  );
}
