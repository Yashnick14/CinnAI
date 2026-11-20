import { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { theme } from "../config/theme";

const SIZE = 58;
const MARGIN = 20;
const DRAG_DISTANCE = 6;

/** Keep the launcher inside its actual content area, including after rotation. */
function constrain(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

/** Allow dragging the assistant independently of tapping to open its conversation. */
export function AssistantLauncher({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const offset = useRef(new Animated.ValueXY()).current;
  const bounds = useRef({ width: 0, height: 0, top: MARGIN });
  const position = useRef({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);
  const dragging = useRef(false);

  const move = (x: number, y: number) => {
    const area = bounds.current;
    position.current = {
      x: constrain(
        x,
        Math.min(MARGIN, Math.max(0, area.width - SIZE)),
        area.width - SIZE - MARGIN,
      ),
      y: constrain(
        y,
        Math.min(area.top, Math.max(0, area.height - SIZE)),
        area.height - SIZE - MARGIN,
      ),
    };
    offset.setValue(position.current);
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.hypot(gesture.dx, gesture.dy) > DRAG_DISTANCE,
      onPanResponderGrant: () => {
        dragging.current = true;
        origin.current = { ...position.current };
      },
      onPanResponderMove: (_, gesture) => {
        move(origin.current.x + gesture.dx, origin.current.y + gesture.dy);
      },
      // Keep press suppression until the next touch starts, so releasing a drag
      // cannot accidentally open the assistant.
      onPanResponderRelease: () => {},
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        dragging.current = true;
      },
    }),
  ).current;

  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}
      onLayout={({ nativeEvent: { layout } }) => {
        bounds.current = { ...layout, top: Math.max(MARGIN, insets.top) };
        if (!initialized.current) {
          initialized.current = true;
          move(layout.width - SIZE - MARGIN, layout.height - SIZE - MARGIN);
        } else {
          move(position.current.x, position.current.y);
        }
      }}
    >
      <Animated.View
        {...responder.panHandlers}
        style={[styles.position, { transform: offset.getTranslateTransform() }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open CinnAI Assistant"
          accessibilityHint="Tap to ask about cinnamon, or drag to reposition the button"
          onPressIn={() => {
            dragging.current = false;
          }}
          onPress={() => {
            if (!dragging.current) onPress();
          }}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Svg
            width={30}
            height={30}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            accessible={false}
          >
            <Rect x={4} y={7} width={16} height={13} rx={4} />
            <Path d="M12 7V4M2 11V16M22 11V16M9 16H15" />
            <Circle cx={12} cy={3} r={1} />
            <Circle cx={8.5} cy={11.5} r={1} fill="white" stroke="none" />
            <Circle cx={15.5} cy={11.5} r={1} fill="white" stroke="none" />
          </Svg>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  position: { position: "absolute", left: 0, top: 0, width: SIZE, height: SIZE },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.primaryLight,
    ...theme.shadow(6),
  },
});
