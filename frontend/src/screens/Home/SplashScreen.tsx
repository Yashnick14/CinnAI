import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../config/theme";
import type { ScreenProps } from "../../types/navigation";
import { HeroPhoto } from "../../components/HeroPhoto";
import { BrandLogo } from "../../components/BrandLogo";
import { Icon } from "../../components/Icon";

export function SplashScreen({ navigation }: ScreenProps<"Splash">) {
  const { height } = useWindowDimensions();

  // Staggered entrance animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(20)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(30)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      // Logo entrance
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
      // Tagline slide up
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslate, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // CTA button
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(ctaTranslate, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Subtle shimmer loop on the CTA
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [
    logoOpacity,
    logoScale,
    taglineOpacity,
    taglineTranslate,
    ctaOpacity,
    ctaTranslate,
    shimmer,
  ]);

  const ctaScale = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const heroHeight = Math.max(260, Math.min(400, height * 0.45));

  return (
    <View style={styles.root}>
      <HeroPhoto
        style={{ height: heroHeight }}
      >
        <View style={styles.heroOverlay}>
          <SafeAreaView edges={["top"]} style={styles.heroSafe}>
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <BrandLogo width={220} />
            </Animated.View>
            <Animated.View
              style={{
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslate }],
              }}
            >
              <Text style={styles.heroSubtitle}>CEYLON CINNAMON</Text>
            </Animated.View>
          </SafeAreaView>
        </View>
      </HeroPhoto>

      <SafeAreaView
        edges={["bottom"]}
        style={styles.bottom}
      >
        <View style={styles.content}>
          <Animated.View
            style={{
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslate }],
            }}
          >
            <Text style={styles.headline}>
              Precision grading{"\n"}for every quill.
            </Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: ctaOpacity,
              transform: [
                { translateY: ctaTranslate },
              ],
              gap: 12,
            }}
          >
            <Text style={styles.featureLabel}>
              Intelligent Hybrid Grading
            </Text>

            <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Dashboard"
                onPress={() => navigation.replace("Home")}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.ctaText}>Open Dashboard</Text>
                <Icon name="arrow" size={18} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: "#1A0E0840",
  },
  heroSafe: {
    flex: 1,
    padding: 28,
    justifyContent: "flex-end",
    gap: 6,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  logoText: {
    color: "#FFF",
    fontFamily: theme.serif,
    fontSize: 42,
    fontWeight: "700",
  },
  logoLeaf: {
    fontSize: 36,
    color: theme.accentGold,
  },
  heroSubtitle: {
    color: "#F3DECA",
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "600",
  },
  bottom: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flex: 1,
    padding: 28,
    justifyContent: "space-between",
  },
  headline: {
    fontFamily: theme.serif,
    color: theme.ink,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "700",
  },
  featureLabel: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: theme.radius.md,
    ...theme.shadow(4),
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
