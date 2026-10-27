import { useDesktopLayout } from "../../hooks/useDesktopLayout";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "../../components/AppText";
import {
  Body,
  Button,
  Card,
  DemoNotice,
  Heading,
  Label,
  Page,
  Row,
  StatusBadge,
  WarningMessage,
} from "../../components/ui";
import { ConfidenceRing } from "../../components/ConfidenceRing";
import { Icon } from "../../components/Icon";
import { useSensor } from "../../hooks/useSensor";
import { MockSensorService, sensorService } from "../../services/ble";
import { dateTime, errorMessage } from "../../utils/format";
import { theme } from "../../config/theme";
import { ADC_THRESHOLD, BLE } from "../../config/ble";
import { provisionalLabel } from "../../services/sensorReading";
export function SensorScreen() {
  const desktop = useDesktopLayout();
  const sensor = useSensor();
  const [error, setError] = useState("");
  const [showChecks, setShowChecks] = useState(false);
  const busy = sensor.state === "scanning" || sensor.state === "connecting";
  const wifi = BLE.mode === "wifi";
  async function action(operation: () => Promise<void>) {
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Page topInset>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Heading title="Moisture Sensor" />
        <StatusBadge label="ESP32 IoT" tone="blue" />
      </View>
      <View
        style={{
          flexDirection: desktop ? "row" : "column",
          gap: desktop ? 24 : 14,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: desktop ? 0.9 : undefined, minWidth: 0, gap: 14 }}>
          <Card
            style={{
              backgroundColor: theme.paper,
              borderWidth: 0,
              alignItems: "center",
              paddingVertical: 20,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                wifi ? "Find Wi-Fi Sensor" : "Scan for Sensor"
              }
              accessibilityState={{
                disabled: busy || sensor.state === "connected",
                busy,
              }}
              disabled={busy || sensor.state === "connected"}
              onPress={() => void action(sensor.scan)}
              style={{
                backgroundColor: theme.blueBg,
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {busy ? (
                <ActivityIndicator color={theme.blue} />
              ) : (
                <Icon
                  name={wifi ? "wifi" : "bluetooth"}
                  size={28}
                  color={theme.blue}
                />
              )}
            </Pressable>
            <Body>
              {sensor.state === "scanning"
                ? sensor.isMock
                  ? "Scanning for simulated moisture probes…"
                  : wifi
                    ? "Checking the configured Wi-Fi sensor…"
                    : "Scanning for CinnamonGradingSensor…"
                : sensor.state === "connecting"
                  ? sensor.isMock
                    ? "Connecting to the simulated sensor…"
                    : "Connecting to CinnamonGradingSensor…"
                  : sensor.state === "connected"
                    ? "Moisture probe connected"
                    : "Connect your moisture probe"}
            </Body>
          </Card>
          {sensor.isMock && <DemoNotice />}
          {wifi && (
            <Card>
              <Row label="Connection method" value="Local Wi-Fi · Expo Go" />
            </Card>
          )}
          {(sensor.error || error) && (
            <WarningMessage text={sensor.error ?? error} error />
          )}
          {sensor.state === "connected" && sensor.device && (
            <Card>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Icon
                  name={wifi ? "wifi" : "bluetooth"}
                  color={theme.blue}
                  size={20}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Label>{sensor.device.name}</Label>
                  <Body>
                    {sensor.isMock
                      ? "Simulated reading · every 5 seconds"
                      : wifi
                        ? "Live median ADC · Wi-Fi updates"
                        : "Live median ADC · BLE notifications"}
                  </Body>
                </View>
                <StatusBadge label="Connected" tone="blue" />
              </View>
            </Card>
          )}
          {sensor.state !== "connected" &&
            sensor.devices.map((device) => (
              <Card key={device.id}>
                <Label>{device.name}</Label>
                <Button
                  title="Connect Sensor"
                  color={theme.blue}
                  disabled={busy}
                  onPress={() => void action(() => sensor.connect(device.id))}
                />
              </Card>
            ))}
        </View>
        <View style={{ flex: desktop ? 1.1 : undefined, minWidth: 0, gap: 14 }}>
          <Card
            style={{ alignItems: "center", paddingVertical: desktop ? 32 : 23 }}
          >
            {sensor.isMock ? (
              <ConfidenceRing
                value={
                  sensor.moisturePercent === null
                    ? null
                    : sensor.moisturePercent / 100
                }
                label=""
                color={theme.blue}
                track="#DEEBF3"
                size={110}
              />
            ) : (
              <View
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  borderWidth: 4,
                  borderColor: "#DEEBF3",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.paper,
                }}
              >
                <Text
                  style={{ fontSize: 25, fontWeight: "800", color: theme.blue }}
                >
                  {sensor.medianAdc ?? "—"}
                </Text>
                <Text style={{ fontSize: 10, color: theme.muted }}>
                  MEDIAN ADC
                </Text>
              </View>
            )}
            <Text
              style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}
            >
              {sensor.isMock
                ? "Moisture Content (Simulated)"
                : "Live Median ADC"}
            </Text>
            <Body>
              {(sensor.isMock ? sensor.moisturePercent : sensor.medianAdc) ==
              null
                ? "No reading received"
                : "Latest reading from the connected sensor"}
            </Body>
            {!sensor.isMock && (
              <>
                <StatusBadge
                  label={
                    sensor.stale
                      ? "Stale reading — waiting for update"
                      : provisionalLabel(sensor.provisionalStatus)
                  }
                  tone={
                    sensor.stale || !sensor.provisionalStatus
                      ? "neutral"
                      : sensor.provisionalStatus === "PASS"
                        ? "success"
                        : "danger"
                  }
                />
              </>
            )}
          </Card>
          <Card>
            <Row label="Connection" value={sensor.state} />
            <Row
              label="Last updated"
              value={
                sensor.updatedAt ? dateTime(sensor.updatedAt) : "No reading"
              }
            />
            <Row
              label={sensor.isMock ? "Compliance requirement" : "ADC threshold"}
              value={sensor.isMock ? "Below 14.0%" : String(ADC_THRESHOLD)}
            />
          </Card>
          {sensor.state === "connected" ? (
            <Button
              title="Disconnect Sensor"
              color={theme.blue}
              secondary
              onPress={sensor.disconnect}
            />
          ) : (
            <Button
              title="Reconnect"
              icon="refresh"
              color={theme.blue}
              secondary
              disabled={busy}
              onPress={() => void action(sensor.reconnect)}
            />
          )}
          {sensor.isMock && (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowChecks(!showChecks)}
                style={{ paddingVertical: 10 }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.primary,
                    textAlign: "center",
                  }}
                >
                  {showChecks ? "Hide connection checks" : "Connection checks"}
                </Text>
              </Pressable>
              {showChecks && (
                <Card>
                  <Button
                    title="Simulate Connection Loss"
                    secondary
                    onPress={() => {
                      if (sensorService instanceof MockSensorService)
                        sensorService.simulateFailure("disconnect");
                    }}
                  />
                  <Button
                    title="Simulate Timeout"
                    secondary
                    onPress={() => {
                      if (sensorService instanceof MockSensorService)
                        sensorService.simulateFailure("timeout");
                    }}
                  />
                </Card>
              )}
            </>
          )}
        </View>
      </View>
    </Page>
  );
}
