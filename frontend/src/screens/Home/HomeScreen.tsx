import { HomeNavbar } from "../../components/HomeNavbar";
import { useCallback, useRef, useEffect, useState } from "react";
import {
  useWindowDimensions,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { GradingResult } from "../../types/grading";
import type { ScreenProps } from "../../types/navigation";
import { history } from "../../storage/history";
import { useSensor } from "../../hooks/useSensor";
import {
  Body,
  Button,
  Card,
  DemoNotice,
  Label,
  StatusBadge,
  WarningMessage,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { HistoryRow } from "../../components/HistoryRow";
import { HeroVideo } from "../../components/HeroVideo";
import { BrandLogo } from "../../components/BrandLogo";
import { errorMessage, percent } from "../../utils/format";
import { isToday, summarize } from "../../utils/historySummary";
import { theme } from "../../config/theme";

/* ─── Animated Metric Card ──────────────────────────────────────────── */

function MetricCard({
  value,
  label,
  color = theme.ink,
  delay = 0,
}: {
  value: string;
  label: string;
  color?: string;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, scale, delay]);

  return (
    <Animated.View
      style={[
        styles.metric,
        theme.shadow(2),
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <Text style={[styles.metricNumber, { color }]}>{value}</Text>
      <Text style={styles.metricCaption}>{label}</Text>
    </Animated.View>
  );
}

/* ─── Home Screen ───────────────────────────────────────────────────── */

export function HomeScreen({ navigation }: ScreenProps<"Home">) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const sensor = useSensor();
  const [records, setRecords] = useState<GradingResult[]>([]);
  const [error, setError] = useState("");

  // Hero entrance
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(1.05)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandTranslate = useRef(new Animated.Value(-12)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(heroScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(brandTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(ctaTranslate, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [heroOpacity, heroScale, brandOpacity, brandTranslate, ctaOpacity, ctaTranslate]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      history
        .list()
        .then((r) => {
          if (active) {
            setRecords(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const summary = summarize(records.filter((r) => isToday(r.timestamp)));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <HomeNavbar onAccount={() => navigation.navigate("Account")} onSettings={() => navigation.navigate("Settings")} />
      {/* ── Hero Section ──────────────────────────────────────── */}
      <Animated.View
        style={{
          opacity: heroOpacity,
          transform: [{ scale: heroScale }],
        }}
      >
        <HeroVideo style={[styles.hero, desktop && { height: 400 }]}>
          <View style={styles.heroOverlay}>
            <View style={styles.heroInner}>


              <Animated.View
                style={[
                  styles.heroCtaContainer,
                  {
                    opacity: ctaOpacity,
                    transform: [{ translateY: ctaTranslate }],
                  },
                ]}
              >
                <Text style={[styles.heroHeadline, desktop && { fontSize: 36, lineHeight: 48 }]}>Every quill has a story.{"\n"}<Text style={styles.heroHeadlineAccent}>Start with the evidence.</Text></Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start New Grading"
                  onPress={() => navigation.navigate("Preparation")}
                  style={({ pressed }) => [
                    styles.heroCta,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Icon name="camera" color="#FFFFFF" size={22} />
                  <Text style={styles.heroCtaText}>New Grading</Text>
                  <Icon name="arrow" color="#FFFFFF" size={16} />
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </HeroVideo>
      </Animated.View>

      {/* ── Dashboard Content ─────────────────────────────────── */}
      <View style={[styles.content, desktop && { width: "100%", maxWidth: 1240, alignSelf: "center", paddingHorizontal: 32, paddingTop: 24, gap: 20 }]}>
        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <MetricCard
            value={String(summary.count)}
            label="Today"
            delay={400}
          />
          <MetricCard
            value={
              summary.averageConfidence === null
                ? "—"
                : percent(summary.averageConfidence)
            }
            label="Avg Confidence"
            color={theme.primary}
            delay={500}
          />
          <MetricCard
            value={summary.common ?? "—"}
            label="Top Grade"
            color={theme.accent}
            delay={600}
          />
        </View>




        {/* Recent Gradings */}
        <View style={styles.sectionHeader}>
          <Label>Recent</Label>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all grading history"
            onPress={() => navigation.navigate("History")}
          >
            <Text style={styles.viewAll}>View all →</Text>
          </Pressable>
        </View>

        {error && <WarningMessage text={error} error />}

        {records.slice(0, 3).map((r) => (
          <HistoryRow
            compact
            key={r.id}
            result={r}
            onPress={() =>
              navigation.navigate("HistoryDetail", { id: r.id })
            }
          />
        ))}

        {records.length === 0 && (
          <Card>
            <View style={styles.emptyState}>
              <Icon name="history" size={32} color={theme.line} />
              <Body>No samples graded yet. Start your first grading above.</Body>
            </View>
          </Card>
        )}

        {/* Sensor Status Strip */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage Sensor"
          onPress={() => navigation.navigate("Sensor")}
          style={({ pressed }) => [
            styles.sensorStrip,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={styles.sensorIcon}>
            <Icon
              name="bluetooth"
              color={sensor.state === "connected" ? theme.blue : theme.muted}
              size={16}
            />
          </View>
          <Text style={styles.sensorLabel}>Moisture</Text>
          <StatusBadge
            label={`${sensor.isMock ? "Simulated · " : ""}${sensor.state}`}
            tone={sensor.state === "connected" ? "blue" : "neutral"}
          />
          <Icon name="chevron" size={14} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 320, backgroundColor: "#2A1A10" },
  heroOverlay: { flex: 1, backgroundColor: "#0D070440" },
  heroInner: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 0,
    justifyContent: "center",
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    color: "#FFF",
    fontFamily: theme.serif,
    fontSize: 32,
    fontWeight: "700",
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF18",
    borderWidth: 1,
    borderColor: "#FFFFFF20",
    alignItems: "center",
    justifyContent: "center",
  },
  heroHeadline: { color: "#FFFFFF", fontSize: 24, lineHeight: 34, fontWeight: "600", textAlign: "center" },
  heroHeadlineAccent: { color: "#EADBBC" },
  heroCtaContainer: {
    gap: 20,
    alignItems: "center",
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.radius.md,
    ...theme.shadow(6),
  },
  heroCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  content: {
    padding: 18,
    gap: 12,
    marginTop: -16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metric: {
    flex: 1,
    backgroundColor: theme.paper,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: "center",
    gap: 4,
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.ink,
  },
  metricCaption: {
    color: theme.muted,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  viewAll: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.primary,
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  sensorStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: theme.paper,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.line,
    ...theme.shadow(1),
  },
  sensorIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.blueBg,
    alignItems: "center",
    justifyContent: "center",
  },
  sensorLabel: {
    flex: 1,
    color: theme.ink,
    fontSize: 13,
    fontWeight: "600",
  },
});





