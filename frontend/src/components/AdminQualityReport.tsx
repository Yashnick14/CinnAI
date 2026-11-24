import { loadReportSettings, type ReportSettings } from "../services/reportSettings";
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
import { WarningMessage, Button } from "./ui";
import { theme } from "../config/theme";

/** Keep admin reporting in History and fail closed on sign-out or permission errors. */
export type AdminHistoryData = {
  owner: string;
  records: Awaited<ReturnType<typeof adminReportRecords>>;
  names: Record<string, string>;
};
export function AdminQualityReport({
  onHistory,
}: {
  onHistory: (data: AdminHistoryData | null) => void;
}) {
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState<string | null>(null);
  const [users, setUsers] = useState<{ uid: string; name: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [records, setRecords] = useState<GradingResult[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const owner = user?.uid;
      onHistory(null);
      setAuthorized(null);
      setLoading(true);
      setError("");
      setRecords([]);
      setSettings(null);
      if (owner)
        void (async () => {
          try {
            const permission = z
              .object({ can_generate_reports: z.boolean() })
              .parse(await cloudRequest("/permissions", {}, owner));
            if (!permission.can_generate_reports || !active) return;
            setAuthorized(owner);
            const people = z
              .array(z.object({ uid: z.string(), name: z.string() }))
              .parse(await cloudRequest("/admin/report-users", {}, owner));
            const names = Object.fromEntries(
              people.map((person, index) => [
                person.uid,
                person.name.trim() &&
                person.name !== person.uid &&
                person.name !== "Name not available"
                  ? person.name
                  : `Grader ${index + 1}`,
              ]),
            );
            const [rows, savedSettings] = await Promise.all([
              adminReportRecords(selected, owner),
              loadReportSettings(owner),
            ]);
            if (active) {
              setUsers(
                people.map((person) => ({
                  ...person,
                  name: names[person.uid] ?? "Name not available",
                })),
              );
              onHistory({ owner, records: rows, names });
              setRecords(rows);
              setSettings(savedSettings);
              setAuthorized(owner);
            }
          } catch {
            if (active) setError("Could not load grader records. Please retry.");
          } finally {
            if (active) setLoading(false);
          }
        })();
      return () => {
        active = false;
      };
    }, [user?.uid, selected, onHistory, retry]),
  );
  if (!user || authorized !== user.uid) return null;
  return (
    <View style={{ gap: 12 }}>
      {!!error && (
        <>
          <WarningMessage text={error} error />
          <Button title="Retry" onPress={() => setRetry((value) => value + 1)} />
        </>
      )}
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
        settings={settings}
        loading={loading}
        unavailable={!!error}
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
