import type { PropsWithChildren } from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";

// Explicit dimensions prevent the web image's intrinsic size from escaping its container.
export function HeroPhoto({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      style={[
        {
          width: "100%",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#3D281C",
        },
        style,
      ]}
    >
      <Image
        source={require("../../assets/cinnamon-hero.png")}
        resizeMode="cover"
        accessible={false}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
      {children}
    </View>
  );
}
