import { useCallback, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { cloudRequest } from "../services/cloudApi";
import { adminReportRecords } from "../services/adminReports";
import type { GradingResult } from "../types/grading";
import { QualityReportExport } from "./QualityReportExport";
import { Text } from "./AppText";
import { theme } from "../config/theme";

/** Keep admin reporting in History and fail closed on sign-out or permission errors. */
export function AdminQualityReport() {
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState<string | null>(null);
  const [users, setUsers] = useState<{ uid: string; name: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [records, setRecords] = useState<GradingResult[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const owner = user?.uid;
      setAuthorized(null);
      setLoading(true);
      setRecords([]);
      if (owner)
        void (async () => {
          try {
            const permission = z
              .object({ can_generate_reports: z.boolean() })
              .parse(await cloudRequest("/permissions", {}, owner));
            if (!permission.can_generate_reports || !active) return;
            const people = z
              .array(z.object({ uid: z.string(), name: z.string() }))
              .parse(await cloudRequest("/admin/report-users", {}, owner));
            const rows = await adminReportRecords(selected, owner);
            if (active) {
              setUsers(people);
              setRecords(rows);
              setAuthorized(owner);
            }
          } catch {
            if (active) setAuthorized(null);
          } finally {
            if (active) setLoading(false);
          }
        })();
      return () => {
        active = false;
      };
    }, [user?.uid, selected]),
  );
  if (!user || authorized !== user.uid) return null;
  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[{ uid: "", name: "All graders" }, ...users].map((person) => (
          <Pressable
            key={person.uid}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === person.uid }}
            onPress={() => setSelected(person.uid)}
            style={{
              padding: 10,
              borderRadius: 16,
              backgroundColor: selected === person.uid ? theme.primary : theme.paper,
            }}
          >
            <Text style={{ color: selected === person.uid ? "white" : theme.ink }}>
              {person.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <QualityReportExport
        records={records}
        loading={loading}
        unavailable={false}
        reportUser={selected}
        reportLabel={
          selected
            ? users.find((person) => person.uid === selected)?.name
            : "All graders"
        }
      />
    </View>
  );
}
