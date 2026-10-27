import React from "react";
const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (node: React.ReactNode) => string;
};
import { expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({
  user: null as null | { uid: string },
  loading: false,
  error: null,
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => session }));
vi.mock("react-native", () => ({
  View: ({ children }: any) => React.createElement("div", null, children),
  ActivityIndicator: () => React.createElement("span", null, "loading"),
  Platform: { OS: "web", select: (v: any) => v.default },
}));
vi.mock("@react-navigation/native", () => ({
  NavigationContainer: ({ children }: any) =>
    React.createElement("div", null, children),
  DefaultTheme: { colors: {} },
  createNavigationContainerRef: () => ({ isReady: () => false }),
}));
vi.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) =>
      React.createElement("div", null, children),
    Group: ({ children }: any) => React.createElement("div", null, children),
    Screen: ({ name }: any) =>
      React.createElement("span", null, "route:" + name + ";"),
  }),
}));
vi.mock("../src/navigation/WorkspaceFrame", () => ({
  WorkspaceFrame: ({ children }: any) =>
    React.createElement("div", null, children),
}));
vi.mock("../src/navigation/BottomNavigation", () => ({
  BottomNavigation: () => React.createElement("span", null, "tabs"),
}));
vi.mock("../src/components/AssistantLauncher", () => ({
  AssistantLauncher: () =>
    React.createElement("span", null, "assistant-launcher"),
}));
vi.mock("../src/screens/Auth/AuthScreen", () => ({ AuthScreen: () => null }));
vi.mock("../src/screens/Auth/AccountScreen", () => ({ AccountScreen: () => null }));
vi.mock("../src/screens/Results/ManualReviewScreen", () => ({
  ManualReviewScreen: () => null,
}));
vi.mock("../src/screens/Assistant/AssistantScreen", () => ({
  AssistantScreen: () => null,
}));
vi.mock("../src/screens/Home/SplashScreen", () => ({ SplashScreen: () => null }));
vi.mock("../src/screens/Home/HomeScreen", () => ({ HomeScreen: () => null }));
vi.mock("../src/screens/Analyze/PreparationScreen", () => ({
  PreparationScreen: () => null,
}));
vi.mock("../src/screens/Analyze/CameraScreen", () => ({ CameraScreen: () => null }));
vi.mock("../src/screens/Analyze/ImageReviewScreen", () => ({
  ImageReviewScreen: () => null,
}));
vi.mock("../src/screens/Analyze/AnalysingScreen", () => ({
  AnalysingScreen: () => null,
}));
vi.mock("../src/screens/Results/ResultScreen", () => ({ ResultScreen: () => null }));
vi.mock("../src/screens/History/HistoryScreen", () => ({ HistoryScreen: () => null }));
vi.mock("../src/screens/History/HistoryDetailScreen", () => ({
  HistoryDetailScreen: () => null,
}));
vi.mock("../src/screens/Sensor/SensorScreen", () => ({ SensorScreen: () => null }));
vi.mock("../src/screens/Settings/SettingsScreen", () => ({
  SettingsScreen: () => null,
}));
import { AppNavigator } from "../src/navigation/AppNavigator";
it("signed-out users can only access auth routes", () => {
  session.user = null;
  session.loading = false;
  const html = renderToStaticMarkup(React.createElement(AppNavigator));
  expect(html).toContain("route:Login;");
  expect(html).toContain("route:Register;");
  expect(html).not.toContain("route:Home;");
  expect(html).not.toContain("route:History;");
  expect(html).not.toContain("assistant-launcher");
  expect(html).not.toContain("tabs");
});
it("restoring a session never exposes Home or login prematurely", () => {
  session.loading = true;
  const html = renderToStaticMarkup(React.createElement(AppNavigator));
  expect(html).toContain("loading");
  expect(html).not.toContain("route:");
  session.loading = false;
});
it("signed-in users get protected routes and cannot navigate back to login", () => {
  session.user = { uid: "member" };
  const html = renderToStaticMarkup(React.createElement(AppNavigator));
  expect(html).toContain("route:Home;");
  expect(html).toContain("route:Camera;");
  expect(html).not.toContain("route:Login;");
});
it("sign-out removes protected routes", () => {
  session.user = { uid: "member" };
  renderToStaticMarkup(React.createElement(AppNavigator));
  session.user = null;
  const html = renderToStaticMarkup(React.createElement(AppNavigator));
  expect(html).toContain("route:Login;");
  expect(html).not.toContain("route:Result;");
  expect(html).not.toContain("route:Home;");
});
