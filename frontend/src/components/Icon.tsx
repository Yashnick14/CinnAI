import Svg, { Path, Circle } from "react-native-svg";
import { Platform } from "react-native";
import { theme } from "../config/theme";
export type IconName =
  | "home"
  | "camera"
  | "bluetooth"
  | "wifi"
  | "history"
  | "arrow"
  | "chevron"
  | "search"
  | "settings"
  | "check"
  | "info"
  | "refresh"
  | "flash"
  | "leaf";
const paths: Record<IconName, string> = {
  home: "M3 10 12 3 21 10V21H15V14H9V21H3Z",
  camera: "M3 7H7L9 4H15L17 7H21V20H3Z",
  bluetooth: "M12 2V22L19 16 5 5M5 19 19 8 12 2",
  wifi: "M2 8A16 16 0 0 1 22 8M5 12A11 11 0 0 1 19 12M8 16A6 6 0 0 1 16 16M12 20V20.1",
  history: "M12 7V12L16 15",
  arrow: "M4 12H20M14 6 20 12 14 18",
  chevron: "M9 5 16 12 9 19",
  search: "M16 16 21 21",
  settings:
    "M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6 7 7M17 17 18.4 18.4M5.6 18.4 7 17M17 7 18.4 5.6",
  check: "M5 12 10 17 20 6",
  info: "M12 11V17M12 7V7.1",
  refresh: "M20 8A8 8 0 1 0 20 16M20 3V8H15",
  flash: "M13 2 4 14H11L10 22 20 9H13Z",
  leaf: "M20 3C8 2 2 8 5 16C13 21 21 13 20 3ZM4 21 16 8",
};
export function Icon({
  name,
  size = 22,
  color = theme.muted,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(Platform.OS === "web" ? { "aria-hidden": true as const } : { accessible: false })}
    >
      <Path d={paths[name]} />
      {name === "camera" && <Circle cx={12} cy={13} r={3.5} />}
      {(name === "history" || name === "info") && (
        <Circle cx={12} cy={12} r={9} />
      )}
      {name === "search" && <Circle cx={10} cy={10} r={6.5} />}
      {name === "settings" && (
        <>
          <Circle cx={12} cy={12} r={7} />
          <Circle cx={12} cy={12} r={2.5} />
        </>
      )}
    </Svg>
  );
}
