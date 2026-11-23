import { moistureLabel } from "../utils/moistureLabel";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./AppText";
import type { GradingResult } from "../types/grading";
import { theme } from "../config/theme";
import { dateTime, measurement, percent } from "../utils/format";
import { recordLabel } from "../utils/historySummary";
import { Icon } from "./Icon";

/** Render one saved grading record with its navigation action. */
export function HistoryRow({
  result,
  onPress,
  compact = false,
  onDelete,
  deleteDisabled = false,
}: {
  result: GradingResult;
  onPress: () => void;
  compact?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open record ${recordLabel(result.id)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
    >
      {!compact &&
        (result.imageUri && !imageFailed ? (
          <Image
            source={{ uri: result.imageUri }}
            style={styles.image}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View
            style={[styles.image, { alignItems: "center", justifyContent: "center" }]}
          >
            <Icon name="camera" />
          </View>
        ))}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.id}>#{recordLabel(result.id)}</Text>
        <Text style={styles.meta}>
          {result.isMock ? "Sample data · " : ""}
          {dateTime(result.timestamp)}
        </Text>
        <Text style={styles.meta}>
          Visual confidence: {percent(result.visualConfidence)}
        </Text>
        {!compact && (
          <Text style={styles.meta}>
            {measurement(result.diameterMm, "mm")} ·{" "}
            {moistureLabel(result.moistureStatus, result.moistureRawAdc)}
          </Text>
        )}
        {!compact && (
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color:
                result.finalStatus === "GRADE_ACCEPTED"
                  ? theme.success
                  : result.finalStatus === "MOISTURE_NON_COMPLIANT"
                    ? theme.danger
                    : theme.warning,
            }}
          >
            {result.finalStatus.replace(/_/g, " ")}
          </Text>
        )}
      </View>
      <View style={styles.grade}>
        <Text style={styles.gradeText}>{result.finalGrade ?? "Review"}</Text>
      </View>
      {!compact && (
        <View style={{ gap: 8, alignItems: "center" }}>
          <Icon name="chevron" size={14} />
          {onDelete && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete record"
              disabled={deleteDisabled}
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 6,
                opacity: deleteDisabled ? 0.5 : 1,
              }}
            >
              <Text style={{ color: theme.danger, fontSize: 11 }}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    backgroundColor: theme.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
  },
  image: {
    width: 43,
    height: 43,
    borderRadius: 7,
    backgroundColor: theme.cream,
  },
  id: { color: theme.ink, fontSize: 12, fontWeight: "700" },
  meta: { color: theme.muted, fontSize: 10, lineHeight: 14 },
  grade: {
    backgroundColor: theme.cream,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    maxWidth: 90,
  },
  gradeText: {
    fontFamily: theme.serif,
    fontSize: 14,
    color: theme.primary,
    fontWeight: "700",
  },
});
