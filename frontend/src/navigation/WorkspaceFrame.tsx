import type { PropsWithChildren } from "react";
import { View } from "react-native";
import type { TabName } from "./BottomNavigation";
import { theme } from "../config/theme";
export type WorkspaceProps = PropsWithChildren<{ route: string; onSelect: (tab: TabName) => void; onSettings: () => void }>;
export function WorkspaceFrame({ children }: WorkspaceProps) {
  return <View style={{ flex: 1, backgroundColor: theme.creamDeep, alignItems: "center" }}>
    <View style={{ flex: 1, width: "100%", backgroundColor: theme.background }}>{children}</View>
  </View>;
}

