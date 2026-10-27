import { AuthProvider } from "./src/context/AuthContext";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useAppFonts } from "./src/hooks/useAppFonts";
import { ActivityIndicator, View, Text } from "react-native";
export default function App() {
  const [loaded, error] = useAppFonts();
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#faf5ef",
        }}
      >
        <ActivityIndicator color="#845334" />
        <Text>Loading CinnAI…</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
