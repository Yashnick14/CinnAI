import { useRef, useEffect, useCallback } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "../components/Icon";
import { theme } from "../config/theme";

export type TabName = "Home" | "Camera" | "Sensor" | "History";

const tabs: { name: TabName; icon: IconName }[] = [
  { name: "Home", icon: "home" },
  { name: "Camera", icon: "camera" },
  { name: "Sensor", icon: "bluetooth" },
  { name: "History", icon: "history" },
];

function AnimatedTab({
  tab,
  isActive,
  onPress,
}: {
  tab: { name: TabName; icon: IconName };
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconTranslateY = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconTranslateY, {
        toValue: isActive ? -2 : 0,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(dotScale, {
        toValue: isActive ? 1 : 0,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, iconTranslateY, dotScale]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.88,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tab}
    >
      <Animated.View
        style={{
          transform: [{ scale }, { translateY: iconTranslateY }],
          alignItems: "center",
          gap: 4,
        }}
      >
        <Icon
          name={tab.icon}
          size={22}
          color={isActive ? theme.primary : theme.muted}
        />
        <Text
          style={[
            styles.tabLabel,
            isActive && {
              color: theme.primary,
              fontWeight: "700",
            },
          ]}
        >
          {tab.name}
        </Text>
      </Animated.View>
      {/* Active dot indicator */}
      <Animated.View
        style={[
          styles.activeDot,
          {
            backgroundColor: theme.primary,
            transform: [{ scale: dotScale }],
          },
        ]}
      />
    </Pressable>
  );
}

export function BottomNavigation({
  route,
  onSelect,
}: {
  route: string;
  onSelect: (tab: TabName) => void;
}) {
  const active: TabName = ["History", "HistoryDetail"].includes(route)
    ? "History"
    : route === "Sensor"
      ? "Sensor"
      : ["Home", "Settings"].includes(route)
        ? "Home"
        : "Camera";

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View accessibilityRole="tablist" style={styles.bar}>
        {tabs.map((tab) => (
          <AnimatedTab
            key={tab.name}
            tab={tab}
            isActive={active === tab.name}
            onPress={() => onSelect(tab.name)}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: theme.paper,
    borderTopWidth: 1,
    borderColor: theme.line,
    ...theme.shadow(4),
  },
  bar: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    flexDirection: "row",
    minHeight: 64,
    alignItems: "center",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    minHeight: 60,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: theme.muted,
    fontWeight: "500",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
});

