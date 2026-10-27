import { useAuth } from "../context/AuthContext";
import { AuthScreen } from "../screens/Auth/AuthScreen";
import { AccountScreen } from "../screens/Auth/AccountScreen";
import { ManualReviewScreen } from "../screens/Results/ManualReviewScreen";
import { AssistantLauncher } from "../components/AssistantLauncher";
import { AssistantScreen } from "../screens/Assistant/AssistantScreen";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { WorkspaceFrame } from "./WorkspaceFrame";
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "../config/theme";
import type { RootStackParamList } from "../types/navigation";
import { BottomNavigation, type TabName } from "./BottomNavigation";
import { SplashScreen } from "../screens/Home/SplashScreen";
import { HomeScreen } from "../screens/Home/HomeScreen";
import { PreparationScreen } from "../screens/Analyze/PreparationScreen";
import { CameraScreen } from "../screens/Analyze/CameraScreen";
import { ImageReviewScreen } from "../screens/Analyze/ImageReviewScreen";
import { AnalysingScreen } from "../screens/Analyze/AnalysingScreen";
import { ResultScreen } from "../screens/Results/ResultScreen";
import { HistoryScreen } from "../screens/History/HistoryScreen";
import { HistoryDetailScreen } from "../screens/History/HistoryDetailScreen";
import { SensorScreen } from "../screens/Sensor/SensorScreen";
import { SettingsScreen } from "../screens/Settings/SettingsScreen";
const Stack = createNativeStackNavigator<RootStackParamList>();
const navigation = createNavigationContainerRef<RootStackParamList>();
export function AppNavigator() {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState("Login");
  function selectTab(tab: TabName) {
    if (!user || !navigation.isReady()) return;
    if (tab === "Camera") {
      if (
        [
          "Preparation",
          "Camera",
          "ImageReview",
          "Analysing",
          "Result",
        ].includes(route)
      )
        return;
      navigation.navigate("Preparation");
    } else if (tab === "Home") {
      navigation.resetRoot({ index: 0, routes: [{ name: "Home" }] });
    } else {
      // Keep tab visits bounded and maintain a home destination for all return actions.
      navigation.resetRoot({
        index: 1,
        routes: [{ name: "Home" }, { name: tab }],
      });
    }
  }
  if (loading)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator
          accessibilityLabel="Restoring session"
          color={theme.primary}
        />
      </View>
    );
  return (
    <WorkspaceFrame
      route={route}
      onSelect={selectTab}
      onSettings={() => navigation.isReady() && navigation.navigate("Settings")}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          minWidth: 0,
          overflow: "hidden",
          backgroundColor: theme.background,
        }}
      >
        <NavigationContainer
          ref={navigation}
          onReady={() =>
            setRoute(navigation.getCurrentRoute()?.name ?? "Splash")
          }
          onStateChange={() =>
            setRoute(navigation.getCurrentRoute()?.name ?? "Splash")
          }
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: theme.background,
              primary: theme.primary,
              card: theme.background,
              text: theme.ink,
              border: theme.line,
            },
          }}
        >
          <View style={{ flex: 1 }}>
            <Stack.Navigator
              key={user?.uid ?? "anonymous"}
              initialRouteName={user ? "Home" : "Login"}
              screenOptions={{
                headerShadowVisible: false,
                headerBackTitle: "Back",
                headerTitleStyle: { fontSize: 14 },
                headerTintColor: theme.primary,
                contentStyle: { backgroundColor: theme.background },
              }}
            >
              {!user ? (
                <Stack.Group screenOptions={{ headerShown: false }}>
                  <Stack.Screen
                    name="Login"
                    component={AuthScreen}
                    options={{ title: "Sign in" }}
                  />
                  <Stack.Screen
                    name="Register"
                    component={AuthScreen}
                    options={{ title: "Create account" }}
                  />
                  <Stack.Screen
                    name="ForgotPassword"
                    component={AuthScreen}
                    options={{ title: "Reset password" }}
                  />
                </Stack.Group>
              ) : (
                <Stack.Group>
                  <Stack.Screen
                    name="Account"
                    component={AccountScreen}
                    options={{ title: "Account" }}
                  />
                  <Stack.Screen
                    name="Splash"
                    component={SplashScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="Preparation"
                    component={PreparationScreen}
                    options={{ title: "Prepare Sample" }}
                  />
                  <Stack.Screen
                    name="Camera"
                    component={CameraScreen}
                    options={{ title: "Capture Sample" }}
                  />
                  <Stack.Screen
                    name="ImageReview"
                    component={ImageReviewScreen}
                    options={{ title: "Review Image" }}
                  />
                  <Stack.Screen
                    name="Analysing"
                    component={AnalysingScreen}
                    options={{ title: "Assessment", gestureEnabled: false }}
                  />
                  <Stack.Screen
                    name="Result"
                    component={ResultScreen}
                    options={{
                      title: "Assessment",
                      headerBackVisible: false,
                      gestureEnabled: false,
                    }}
                  />
                  <Stack.Screen
                    name="ManualReview"
                    component={ManualReviewScreen}
                    options={{ title: "Manual Review" }}
                  />
                  <Stack.Screen
                    name="History"
                    component={HistoryScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="HistoryDetail"
                    component={HistoryDetailScreen}
                    options={{ title: "Record Details" }}
                  />
                  <Stack.Screen
                    name="Sensor"
                    component={SensorScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ title: "Settings & About" }}
                  />
                  <Stack.Screen
                    name="Assistant"
                    component={AssistantScreen}
                    options={{ title: "CinnAI Assistant" }}
                  />
                </Stack.Group>
              )}
            </Stack.Navigator>
            {!!user &&
              ![
                "Splash",
                "Assistant",
                "Analysing",
                "Login",
                "Register",
                "ForgotPassword",
              ].includes(route) && (
                <AssistantLauncher
                  onPress={() =>
                    navigation.isReady() && navigation.navigate("Assistant")
                  }
                />
              )}
          </View>
          {!!user &&
            !["Splash", "Login", "Register", "ForgotPassword"].includes(
              route,
            ) && (
              <BottomNavigation
                route={route === "Assistant" ? "Home" : route}
                onSelect={selectTab}
              />
            )}
        </NavigationContainer>
      </View>
    </WorkspaceFrame>
  );
}
