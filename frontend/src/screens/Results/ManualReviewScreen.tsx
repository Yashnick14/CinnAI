import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Text } from "../../components/AppText";
import {
  Body,
  Button,
  Card,
  Heading,
  Label,
  Page,
  WarningMessage,
} from "../../components/ui";
import { CapturedPhoto } from "../../components/CapturedPhoto";
import { theme } from "../../config/theme";
import { SUPPORTED_GRADES } from "../../config/grading";
import type { ScreenProps } from "../../types/navigation";
import type { Grade } from "../../types/grading";
import { reviewedRecord } from "../../services/manualReview";
import { history } from "../../storage/history";

const reasons = [
  "Boundary measurement requires review",
  "Visual inspection disagrees",
  "Measurement appears incorrect",
  "Automatic checks could not complete",
  "Other",
];
function Select({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          padding: 14,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 12,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: theme.primary }}>
          {value || "Select an option"}
        </Text>
        <Text>{open ? "−" : "⌄"}</Text>
      </Pressable>
      {open && (
        <Card>
          {options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: option === value }}
              onPress={() => {
                onSelect(option);
                setOpen(false);
              }}
              style={{
                padding: 12,
                backgroundColor: option === value ? theme.cream : theme.paper,
              }}
            >
              <Text>{option}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </View>
  );
}
export function ManualReviewScreen({
  route,
  navigation,
}: ScreenProps<"ManualReview">) {
  const { result } = route.params;
  const assigned = result.status === "VALID" && result.final_grade;
  const [grade, setGrade] = useState<Grade | undefined>();
  const [reason, setReason] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [id] = useState(() => randomUUID());
  const field = {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    padding: 14,
    color: theme.ink,
    backgroundColor: theme.paper,
    fontFamily: "Poppins_400Regular",
  };
  async function confirm() {
    if (lock.current) return;
    if (!grade || !reason || !reviewer.trim()) {
      setError("Select a grade and reason, and enter the reviewer name.");
      return;
    }
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      await history.save(
        reviewedRecord(
          result,
          { selectedGrade: grade, reason, reviewer, notes },
          id,
          new Date().toISOString(),
        ),
      );
      navigation.replace("HistoryDetail", { id });
    } catch {
      setError(
        "Could not save the review. Check your entries and device storage, then retry.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <Page>
      <Heading
        title="Manual Review"
        subtitle={
          result.sessionId
            ? "Sample #" + result.sessionId.slice(0, 8)
            : "Review this sample"
        }
      />
      <Card>
        <CapturedPhoto uri={result.imageUri} height={150} />
        <Label>
          {assigned ? "AUTOMATIC DIAMETER GRADE" : "GRADE SELECTION REQUIRED"}
        </Label>
        <Text style={{ fontSize: 26, color: theme.primary, fontWeight: "700" }}>
          {assigned || "Select a grade below"}
        </Text>
        <Body>
          {result.diagnostics.diameter
            ? "Measured diameter: " +
              result.diagnostics.diameter.quill_diameter_mm.toFixed(2) +
              " mm"
            : "Diameter unavailable"}
        </Body>
        {result.diagnostics.visual && (
          <Body>
            Visual support: {result.diagnostics.visual.visual_prediction} ·{" "}
            {(result.diagnostics.visual.visual_confidence * 100).toFixed(1)}%
            confidence
          </Body>
        )}
      </Card>
      {result.status !== "VALID" && (
        <WarningMessage
          text={
            result.message +
            " A manual selection does not mean the automatic checks passed."
          }
        />
      )}
      <Select
        label={assigned ? "Select override grade" : "Select grade"}
        value={grade ?? ""}
        options={SUPPORTED_GRADES}
        onSelect={(v) => setGrade(v as Grade)}
      />
      <Select
        label={assigned ? "Reason for override" : "Reason for selection"}
        value={reason}
        options={reasons}
        onSelect={setReason}
      />
      <Card>
        <Label>Reviewer name</Label>
        <TextInput
          accessibilityLabel="Reviewer name"
          placeholder="Enter your name"
          value={reviewer}
          onChangeText={setReviewer}
          maxLength={100}
          style={field}
        />
        <Label>Reviewer notes</Label>
        <TextInput
          accessibilityLabel="Reviewer notes"
          placeholder="Describe your inspection and decision"
          value={notes}
          onChangeText={setNotes}
          maxLength={2000}
          multiline
          style={[field, { minHeight: 110, textAlignVertical: "top" }]}
        />
      </Card>
      <Body>
        The reviewer, reason, selected grade and original automatic result are
        saved on this device for traceability. This creates a separate reviewed
        record.
      </Body>
      {!!error && <WarningMessage text={error} error />}
      <Button
        title={assigned ? "Confirm Override & Save" : "Confirm Grade & Save"}
        busy={saving}
        disabled={!grade || !reason || !reviewer.trim()}
        onPress={() => void confirm()}
      />
      <Button
        title="Cancel"
        secondary
        disabled={saving}
        onPress={() => navigation.goBack()}
      />
    </Page>
  );
}
