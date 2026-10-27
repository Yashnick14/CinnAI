import { useDesktopLayout } from "../hooks/useDesktopLayout";
import { type PropsWithChildren, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Text } from "./AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../config/theme";
import { statusLabel } from "../utils/format";
import { Icon, type IconName } from "./Icon";
import { useFadeInUp, staggerDelay } from "../utils/animations";

/* ─── Page Shell ────────────────────────────────────────────────────── */

export function Page({
  children,
  topInset = false,
}: PropsWithChildren<{ topInset?: boolean }>) {
  return (
    <SafeAreaView
      style={s.safe}
      edges={topInset ? ["top", "left", "right"] : ["left", "right"]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Heading ───────────────────────────────────────────────────────── */

export function Heading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const anim = useFadeInUp(0, 400);
  return (
    <Animated.View style={[s.heading, anim]}>
      {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </Animated.View>
  );
}

/* ─── Card ──────────────────────────────────────────────────────────── */

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  const anim = useFadeInUp(60, 380);
  return (
    <Animated.View style={[s.card, theme.shadow(2), style, anim]}>
      {children}
    </Animated.View>
  );
}

/* ─── Body / Label ──────────────────────────────────────────────────── */

export function Body({ children }: PropsWithChildren) {
  return <Text style={s.body}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={s.label}>{children}</Text>;
}

/* ─── Button ────────────────────────────────────────────────────────── */

export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  icon,
  color = theme.primary,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  color?: string;
}) {
  const desktop = useDesktopLayout();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.965,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View
      style={[
        desktop && { width: "100%", maxWidth: 320, alignSelf: "flex-start" },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: disabled || busy, busy }}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || busy}
        style={({ pressed }) => [
          s.button,
          { backgroundColor: color, borderColor: color },
          secondary && [s.secondary, { borderColor: color + "30" }],
          (disabled || busy) && s.disabled,
          pressed && !secondary && { opacity: 0.85 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={secondary ? color : "#FFFFFF"} />
        ) : (
          icon && (
            <Icon name={icon} size={18} color={secondary ? color : "#FFFFFF"} />
          )
        )}
        <Text style={[s.buttonText, secondary && { color }]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ─── Status Badge ──────────────────────────────────────────────────── */

export type Tone = "neutral" | "success" | "warning" | "danger" | "blue";

const tones = {
  neutral: { color: theme.primary, backgroundColor: theme.cream },
  success: { color: theme.success, backgroundColor: theme.successBg },
  warning: { color: theme.warning, backgroundColor: theme.warningBg },
  danger: { color: theme.danger, backgroundColor: theme.dangerBg },
  blue: { color: theme.blue, backgroundColor: theme.blueBg },
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <View style={[s.badge, { backgroundColor: tones[tone].backgroundColor }]}>
      <View style={[s.badgeDot, { backgroundColor: tones[tone].color }]} />
      <Text style={[s.badgeText, { color: tones[tone].color }]}>
        {statusLabel(label)}
      </Text>
    </View>
  );
}

/* ─── Warning / Notice ──────────────────────────────────────────────── */

export function WarningMessage({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[
        s.notice,
        {
          backgroundColor: error ? theme.dangerBg : theme.warningBg,
          borderLeftColor: error ? theme.dangerLight : theme.warningLight,
        },
      ]}
    >
      <Icon
        name="info"
        size={15}
        color={error ? theme.danger : theme.warning}
      />
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          color: error ? theme.danger : theme.warning,
          lineHeight: 18,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/* ─── Demo Notice ───────────────────────────────────────────────────── */

export function DemoNotice() {
  return (
    <View style={s.demo}>
      <Icon name="info" size={14} color={theme.primary} />
      <Text style={s.demoText}>Simulated data · Image not analysed</Text>
    </View>
  );
}

/* ─── Row ───────────────────────────────────────────────────────────── */

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

/* ─── Progress Pipeline ─────────────────────────────────────────────── */

export function Progress({ stage, api }: { stage: number; api: boolean }) {
  const stages = [
    "Quill detection",
    "Visual extraction",
    "Diameter measurement",
    "Grade prediction",
    "Moisture check",
  ];
  return (
    <>
      <Card>
        <Label>Hybrid grading pipeline</Label>
        {stages.map((name, index) => {
          const anim = useFadeInUp(staggerDelay(index, 100), 350);
          return (
            <Animated.View key={name} style={[s.progressRow, anim]}>
              <View
                style={[
                  s.step,
                  index < stage && {
                    backgroundColor: theme.successBg,
                    borderColor: theme.success + "30",
                  },
                  index === stage && {
                    backgroundColor: theme.cream,
                    borderColor: theme.accent + "40",
                  },
                ]}
              >
                {index < stage ? (
                  <Icon name="check" size={13} color={theme.success} />
                ) : index === stage ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.muted,
                      fontWeight: "600",
                    }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  s.body,
                  { flex: 1 },
                  index === stage && { color: theme.ink, fontWeight: "700" },
                  index < stage && { color: theme.success },
                ]}
              >
                {name}
              </Text>
            </Animated.View>
          );
        })}
      </Card>
      <View style={s.demo}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={[s.demoText, { flex: 1 }]}>
          {api ? "Waiting for backend…" : "Preparing result…"}
        </Text>
      </View>
    </>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  page: {
    padding: 20,
    gap: 14,
    paddingBottom: 28,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  heading: { gap: 6, marginTop: 8, marginBottom: 4 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: theme.accent,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: theme.serif,
    fontWeight: "700",
    color: theme.ink,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.muted,
  },
  body: { fontSize: 12, lineHeight: 19, color: theme.muted },
  label: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: theme.ink,
  },
  card: {
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.paper,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 10,
  },
  button: {
    minHeight: 50,
    padding: 14,
    borderWidth: 1.5,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  notice: {
    padding: 14,
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  demo: {
    padding: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.cream,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.line,
  },
  demoText: {
    flex: 1,
    color: theme.primary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  rowLabel: { flex: 1, color: theme.muted, fontSize: 12, lineHeight: 18 },
  rowValue: {
    flex: 1,
    color: theme.ink,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.creamDeep,
    borderWidth: 1.5,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
