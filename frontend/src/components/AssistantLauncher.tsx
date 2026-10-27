import { Pressable, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { theme } from "../config/theme";

export function AssistantLauncher({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open CinnAI Assistant"
      accessibilityHint="Ask about cinnamon grades and preparation"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={1.7}
        accessible={false}
      >
        <Path
          d="M20 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 1 1 16-5Z"
          strokeLinejoin="round"
        />
        <Circle cx={8} cy={11} r={0.6} fill="white" />
        <Circle cx={12} cy={11} r={0.6} fill="white" />
        <Circle cx={16} cy={11} r={0.6} fill="white" />
      </Svg>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.primaryLight,
    ...theme.shadow(6),
    zIndex: 10,
  },
});
