import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text } from "../../components/AppText";
import { useFocusEffect } from "@react-navigation/native";
import { history } from "../../storage/history";
import type { GradingResult } from "../../types/grading";
import type { ScreenProps } from "../../types/navigation";
import {
  Body,
  Button,
  Card,
  Heading,
  Label,
  Page,
  WarningMessage,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { HistoryRow } from "../../components/HistoryRow";
import { errorMessage, percent } from "../../utils/format";
import { filterHistory, summarize } from "../../utils/historySummary";
import { SUPPORTED_GRADES } from "../../config/grading";
import { theme } from "../../config/theme";
export function HistoryScreen({ navigation }: ScreenProps<"History">) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function removeRecord(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await history.remove(id);
      setRecords((rows) => rows.filter((r) => r.id !== id));
      setDeleting(null);
      setError("");
    } catch {
      setError("Could not delete the record. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const [records, setRecords] = useState<GradingResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Grades");
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      history
        .list()
        .then((r) => {
          if (active) {
            setRecords(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [retry]),
  );
  const visible = filterHistory(records, search, filter);
  const summary = summarize(visible);
  return (
    <Page topInset>
      <Heading
        title="Grading History"
        subtitle="Your local sample and assessment register"
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          paddingHorizontal: 12,
          backgroundColor: theme.paper,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 10,
        }}
      >
        <Icon name="search" size={16} />
        <TextInput
          accessibilityLabel="Search grading history"
          placeholder="Search sample ID, grade or status…"
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, minHeight: 44, color: theme.ink, fontSize: 12 }}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7 }}
      >
        {["All Grades", "Today", ...SUPPORTED_GRADES].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={{
              borderWidth: 1,
              borderColor: filter === value ? theme.primary : theme.line,
              backgroundColor: filter === value ? theme.primary : theme.paper,
              borderRadius: 18,
              paddingVertical: 10,
              paddingHorizontal: 13,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: filter === value ? "#FFF" : theme.muted,
                fontWeight: filter === value ? "700" : "400",
              }}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
          backgroundColor: theme.cream,
          borderRadius: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.line,
        }}
      >
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: "700" }}>
          {summary.count} Saved {summary.count === 1 ? "Sample" : "Samples"}
        </Text>
        <Text style={{ color: theme.ink, fontSize: 10 }}>
          Avg visual:{" "}
          {summary.averageConfidence === null
            ? "—"
            : percent(summary.averageConfidence)}
        </Text>
      </View>
      {loading && <ActivityIndicator color={theme.primary} />}
      {error && (
        <>
          <WarningMessage text={error} error />
          <Button
            title="Retry History"
            onPress={() => setRetry((r) => r + 1)}
          />
        </>
      )}
      {!loading && !error && records.length === 0 && (
        <Card>
          <Label>No saved results yet</Label>
          <Body>
            Complete an assessment and select Save Result to start your
            register.
          </Body>
          <Button
            title="New Grading"
            onPress={() => navigation.navigate("Preparation")}
          />
        </Card>
      )}
      {!loading && records.length > 0 && visible.length === 0 && (
        <Body>No records match this search and filter.</Body>
      )}
      {visible.map((r) => (
        <View key={r.id} style={{ gap: 8 }}>
          <HistoryRow
            result={r}
            onPress={() => navigation.navigate("HistoryDetail", { id: r.id })}
          />
          {deleting === r.id ? (
            <Card>
              <Body>
                Delete this saved record from this device? This does not delete
                backend captures.
              </Body>
              <Button
                title="Delete Record"
                busy={busy}
                onPress={() => void removeRecord(r.id)}
              />
              <Button
                title="Cancel"
                secondary
                disabled={busy}
                onPress={() => setDeleting(null)}
              />
            </Card>
          ) : (
            <Button
              title="Delete"
              secondary
              disabled={busy}
              onPress={() => setDeleting(r.id)}
            />
          )}
        </View>
      ))}
    </Page>
  );
}
