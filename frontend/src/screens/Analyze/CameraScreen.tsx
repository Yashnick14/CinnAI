import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  Platform,
} from "react-native";
import { Text } from "../../components/AppText";
import { CameraView } from "expo-camera";
import { useDeviceCamera } from "../../hooks/useDeviceCamera";
import type { ScreenProps } from "../../types/navigation";
import {
  Button,
  Heading,
  Page,
  StatusBadge,
  WarningMessage,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { theme } from "../../config/theme";
import { captureGuides } from "../../config/captureGuides";
export function CameraScreen({ navigation }: ScreenProps<"Camera">) {
  const device = useDeviceCamera((photo) =>
    navigation.navigate("ImageReview", photo),
  );
  const { permission, camera, ready, busy, error, capture } = device;
  const focused = device.active;
  const [torch, setTorch] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const guides =
    viewport.width > 0 && viewport.height > 0 ? captureGuides(viewport) : null;
  if (!permission)
    return (
      <Page>
        <Heading title="Checking camera permission" />
        <ActivityIndicator />
      </Page>
    );
  if (!permission?.granted)
    return (
      <Page>
        <Heading
          title="Allow camera access"
          subtitle="Capture a clear photo of your cinnamon quills for visual analysis."
        />
        <View
          style={{
            height: 160,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.cream,
            borderRadius: 16,
          }}
        >
          <Icon name="camera" size={48} color={theme.primary} />
        </View>
        <Button
          title={
            permission?.canAskAgain === false
              ? "Open Device Settings"
              : "Allow Camera"
          }
          icon="camera"
          onPress={() => void device.allow()}
        />
        {error && <WarningMessage text={error} error />}
        <Button
          title="Return to Preparation"
          secondary
          onPress={() => navigation.goBack()}
        />
      </Page>
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.dark }}>
      <View style={styles.top}>
        <View>
          <Text style={styles.title}>Capture Sample</Text>
          <Text style={styles.caption}>Cinnamon visual analysis</Text>
        </View>
        <StatusBadge
          label={ready ? "● Camera Ready" : "Starting…"}
          tone={ready ? "success" : "neutral"}
        />
      </View>
      <View
        style={{ flex: 1, minHeight: 220 }}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setViewport({ width, height });
        }}
      >
        {focused && (
          <CameraView
            key={device.session}
            ref={camera}
            facing="back"
            zoom={0}
            mirror={false}
            selectedLens="builtInWideAngleCamera"
            enableTorch={torch}
            style={StyleSheet.absoluteFill}
            onCameraReady={device.onReady}
            onMountError={device.onError}
          />
        )}
        {guides &&
          Object.entries(guides).map(([name, rect]) => (
            <View
              key={name}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: rect.x * viewport.width,
                top: rect.y * viewport.height,
                width: rect.width * viewport.width,
                height: rect.height * viewport.height,
                borderWidth: 2,
                borderColor: "#E0B17D",
                borderRadius: name === "coin" ? 8 : 3,
              }}
            >
              <Text
                style={{
                  color: "#FFF",
                  backgroundColor: "#0009",
                  fontSize: 11,
                  padding: 3,
                }}
              >
                {name === "coin" ? "Rs.10 coin" : "One vertical quill"}
              </Text>
            </View>
          ))}
      </View>
      <View style={styles.tip}>
        <Icon name="info" size={16} color={theme.primary} />
        <Text
          style={{ color: theme.muted, fontSize: 11, lineHeight: 16, flex: 1 }}
        >
          Place the Rs.10 coin fully inside the square and one vertical quill
          inside the tall guide. Use the same flat, plain surface, diffuse
          light, and photograph straight from above.
        </Text>
      </View>
      {error && (
        <>
          <WarningMessage text={error} error />
          <Button
            title="Restart Camera"
            onPress={device.retry}
            disabled={busy}
          />
        </>
      )}
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fixed measurement guides, always enabled"
          style={styles.control}
        >
          <Icon name="camera" color="#E0B17D" />
          <Text style={styles.controlText}>Fixed guides</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture Image"
          accessibilityState={{ disabled: !ready || busy || !focused || !guides, busy }}
          disabled={!ready || busy || !focused || !guides}
          onPress={() =>
            void capture(Platform.OS === "ios" ? viewport : undefined)
          }
          style={[styles.shutter, (!ready || busy) && { opacity: 0.5 }]}
        >
          <View style={styles.shutterInner}>
            {busy && <ActivityIndicator color="#FFF" />}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle flashlight"
          accessibilityState={{ selected: torch }}
          onPress={() => setTorch(!torch)}
          style={styles.control}
        >
          <Icon name="flash" color={torch ? "#E0B17D" : "#FFF"} />
          <Text style={styles.controlText}>Light</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  top: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  caption: { fontSize: 10, color: "#B8B2AC", marginTop: 4 },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 15,
    backgroundColor: theme.cream,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 18,
  },
  control: {
    minWidth: 56,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  controlText: { color: "#DBD5CF", fontSize: 10 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#FFF",
    padding: 4,
  },
  shutterInner: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
