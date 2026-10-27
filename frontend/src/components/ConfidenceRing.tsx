import { View } from "react-native";
import { Text } from "./AppText";
import Svg, { Circle } from "react-native-svg";
import { theme } from "../config/theme";
export function ConfidenceRing({
  value,
  label = "CONFIDENCE",
  color = theme.accent,
  track = theme.line,
  size = 106,
}: {
  value: number | null;
  label?: string;
  color?: string;
  track?: string;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = Math.PI * radius * 2;
  return (
    <View
      accessibilityLabel={`${label}: ${value === null ? "unavailable" : `${(value * 100).toFixed(1)}%`}`}
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill={theme.paper}
          stroke={track}
          strokeWidth={4}
        />
        {value !== null && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={
              circumference * (1 - Math.max(0, Math.min(1, value)))
            }
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
            strokeLinecap="round"
          />
        )}
      </Svg>
      <Text style={{ fontSize: 23, fontWeight: "800", color }}>
        {value === null ? "—" : `${(value * 100).toFixed(1)}%`}
      </Text>
      {!!label && (
        <Text
          style={{
            fontSize: 8,
            marginTop: 3,
            color: theme.muted,
            fontWeight: "600",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}
