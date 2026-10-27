import { Platform } from "react-native";

export const theme = {
  // Core palette – refined warm tones
  ink: "#1E1A17",
  inkSoft: "#3D3732",
  muted: "#8A7F74",
  background: "#FAF8F5",
  paper: "#FFFFFF",
  primary: "#7A4A2A",
  primaryLight: "#A06B42",
  accent: "#C4854E",
  accentGold: "#D4A764",
  line: "#EDE6DD",
  cream: "#FFF8F0",
  creamDeep: "#F5EDE3",

  // Functional blues
  blue: "#1485D6",
  blueBg: "#EAF5FF",
  blueDeep: "#0B6CB5",

  // Dark tones
  dark: "#1A1816",
  darkCard: "#262220",
  darkMuted: "#6B625A",

  // Typography
  serif: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Georgia",
  }),

  // Status palette
  success: "#1A7A47",
  successBg: "#E4F5EA",
  successLight: "#2DA85E",
  danger: "#C62828",
  dangerBg: "#FDEAEA",
  dangerLight: "#EF5350",
  warning: "#E6830A",
  warningBg: "#FFF4E0",
  warningLight: "#FFB74D",

  // Elevation shadows
  shadow: (elevation: number) => {
    if (Platform.OS === "android") {
      return { elevation };
    }
    const offset = Math.min(elevation, 8);
    return {
      shadowColor: "#1E1A17",
      shadowOffset: { width: 0, height: offset / 2 },
      shadowOpacity: 0.06 + elevation * 0.015,
      shadowRadius: elevation * 1.2,
    };
  },

  // Spacing scale
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border radii
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
} as const;
