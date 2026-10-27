import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { VisualRequest } from "./visual";
import type { SampleResult } from "./decision";
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  Account: undefined;
  Splash: undefined;
  Home: undefined;
  Assistant: undefined;
  Preparation: undefined;
  Camera: undefined;
  ImageReview: VisualRequest;
  Analysing: VisualRequest;
  Result: { result: SampleResult };
  ManualReview: { result: SampleResult };
  History: undefined;
  HistoryDetail: { id: string };
  Sensor: undefined;
  Settings: undefined;
};
export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
