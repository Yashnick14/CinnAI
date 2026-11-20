import { Image, Pressable } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../types/navigation";

/** Open Home from the brand, keeping signed-out users within authentication. */
export function BrandLogo({ width = 180 }: { width?: number }) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={user ? "Go to homepage" : "Go to sign in"}
      onPress={() =>
        user ? navigation.navigate("Home") : navigation.navigate("Login")
      }
      style={({ pressed }) => ({ width, padding: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <Image
        source={require("../../assets/1-cropped-bg.png")}
        accessible={false}
        resizeMode="contain"
        style={{ width: width - 16, height: ((width - 16) * 768) / 2000 }}
      />
    </Pressable>
  );
}
