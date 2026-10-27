import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { BrandLogo } from "./BrandLogo";
import { Text } from "./AppText";
import { theme } from "../config/theme";

export function HomeNavbar({
  onSettings,
  onAccount,
}: {
  onSettings: () => void;
  onAccount: () => void;
}) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  return (
    <SafeAreaView edges={["top"]} style={s.bar}>
      <View
        style={[s.row, width >= 900 && { paddingLeft: 24, paddingRight: 32 }]}
      >
        <BrandLogo width={130} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [s.avatar, pressed && { opacity: 0.7 }]}
        >
          <Svg
            width={23}
            height={23}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.primary}
            strokeWidth={1.7}
            accessible={false}
          >
            <Circle cx={12} cy={8} r={3.5} />
            <Path d="M5 21v-2a7 7 0 0 1 14 0v2" strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close profile"
          onPress={() => setOpen(false)}
          style={s.backdrop}
        >
          <Pressable accessibilityViewIsModal onPress={() => {}} style={s.card}>
            <Text style={s.title}>Your profile</Text>
            <Text style={s.guest}>
              {user?.displayName || user?.email || "Guest"}
            </Text>
            <Text style={s.body}>
              {user
                ? "Manage your CinnAI account."
                : "Sign in or create your CinnAI account."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                onAccount();
              }}
              style={s.action}
            >
              <Text style={s.actionText}>
                {user ? "My account" : "Sign in / Register"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                onSettings();
              }}
              style={s.action}
            >
              <Text style={s.actionText}>Settings & about</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={s.close}
            >
              <Text style={s.actionText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  bar: {
    backgroundColor: theme.paper,
    borderBottomWidth: 1,
    borderColor: theme.line,
  },
  row: {
    minHeight: 60,
    paddingLeft: 6,
    paddingRight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.creamDeep,
    borderWidth: 1,
    borderColor: theme.line,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(30,26,23,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: theme.paper,
    padding: 24,
    borderRadius: 20,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.ink },
  guest: { fontSize: 14, fontWeight: "600", color: theme.primary },
  body: { fontSize: 13, lineHeight: 22, color: theme.muted },
  action: {
    backgroundColor: theme.creamDeep,
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  actionText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  close: { padding: 12 },
});
