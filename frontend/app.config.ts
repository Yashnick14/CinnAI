import type { ExpoConfig } from "expo/config";
import project from "./eas-project.json";

const config: ExpoConfig = {
  name: "CinnAI",
  slug: "cinnamon-hybrid-grading",
  owner: "yashnick",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "cinnamongrading",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.yashnick.cinnamonhybridgrading",
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Connect to the development server on your local network.",
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: { package: "com.yashnick.cinnamonhybridgrading" },
  plugins: [
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
      ? [
          [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
    "expo-dev-client",
    [
      "react-native-ble-plx",
      {
        isBackgroundEnabled: false,
        neverForLocation: true,
        bluetoothAlwaysPermission:
          "Allow CinnAI to connect to CinnamonGradingSensor and receive live median ADC readings.",
      },
    ],
    "expo-status-bar",
    [
      "expo-camera",
      {
        cameraPermission:
          "This app uses the camera to capture Ceylon cinnamon quills and the reference coin for grading.",
        recordAudioAndroid: false,
        microphonePermission: false,
      },
    ],
  ],
  extra: project.projectId ? { eas: { projectId: project.projectId } } : {},
};
export default config;
