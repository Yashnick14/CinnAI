import { useRef, useState } from "react";
import { randomUUID } from "expo-crypto";
import { history } from "../storage/history";
import type { SampleResult } from "../types/decision";
import { toHistoryRecord } from "../services/saveAssessment";
import { Body, Button, WarningMessage } from "./ui";
export function SaveAssessment({
  result,
  onHistory,
}: {
  result: SampleResult;
  onHistory: () => void;
}) {
  const [identity] = useState(() => ({
    id: result.sessionId || randomUUID(),
    timestamp: new Date().toISOString(),
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function save() {
    if (busy.current || saved) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await history.save(
        toHistoryRecord(result, identity.id, identity.timestamp),
      );
      setSaved(true);
    } catch {
      setError(
        "Could not save this assessment. Please try again and check available device storage.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      <Button
        title={saved ? "Saved to History" : "Save Result"}
        secondary
        busy={saving}
        disabled={saved}
        onPress={() => void save()}
      />
      {saved && (
        <>
          <Body>Assessment saved on this device.</Body>
          <Button title="View History" secondary onPress={onHistory} />
        </>
      )}
      {!!error && <WarningMessage text={error} error />}
    </>
  );
}
