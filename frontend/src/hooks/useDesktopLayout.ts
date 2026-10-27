import { Platform, useWindowDimensions } from "react-native";

/** Desktop web only: native/mobile layouts retain their existing sizing. */
export function useDesktopLayout() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= 1000;
}
