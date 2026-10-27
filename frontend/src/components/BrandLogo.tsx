import { Image, View } from "react-native";

export function BrandLogo({ width = 180 }: { width?: number }) {
  return <View style={{ width, padding: 8 }}>
    <Image source={require("../../assets/1-cropped-bg.png")} accessibilityLabel="CinnAI cinnamon grading" resizeMode="contain" style={{ width: width - 16, height: (width - 16) * 768 / 2000 }} />
  </View>;
}
