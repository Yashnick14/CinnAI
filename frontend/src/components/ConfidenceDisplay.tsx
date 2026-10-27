import { View } from "react-native";
import { Text } from "./AppText";
import { theme } from "../config/theme";
import { percent } from "../utils/format";
export function ConfidenceDisplay({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ flex: 1, fontSize: 11, color: theme.ink }}>{label}</Text>
      <View
        style={{
          flex: 1,
          height: 6,
          borderRadius: 5,
          backgroundColor: theme.line,
        }}
      >
        <View
          style={{
            height: 6,
            borderRadius: 5,
            backgroundColor: "#D3A06D",
            width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%`,
          }}
        />
      </View>
      <Text
        style={{
          fontSize: 11,
          color: theme.primary,
          fontWeight: "700",
          minWidth: 45,
          textAlign: "right",
        }}
      >
        {value === null ? "—" : percent(value)}
      </Text>
    </View>
  );
}
