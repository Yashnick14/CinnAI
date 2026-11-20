import { Text as NativeText, StyleSheet, type TextProps } from "react-native";

/** Render application text with the shared typography defaults. */
export function Text({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const fontFamily =
    weight === "bold" || Number(weight) >= 700
      ? "Poppins_700Bold"
      : Number(weight) >= 500
        ? "Poppins_600SemiBold"
        : "Poppins_400Regular";
  return (
    <NativeText {...props} style={[style, { fontFamily, fontWeight: "normal" }]} />
  );
}
