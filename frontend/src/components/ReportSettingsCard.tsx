import { useCallback, useRef, useState } from "react";
import { Image, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { cloudRequest, cloudUid } from "../services/cloudApi";
import {
  emptyReportSettings,
  loadReportSettings,
  saveReportSettings,
  type ReportSettings,
} from "../services/reportSettings";
import { Body, Button, Card, Label, WarningMessage } from "./ui";
import { theme } from "../config/theme";

/** Configure the current administrator's company details and inline PDF logo. */
export function ReportSettingsCard() {
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState<string | null>(null);
  const [value, setValue] = useState<ReportSettings>(emptyReportSettings);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const owner = user?.uid;
      setAuthorized(null);
      setValue(emptyReportSettings);
      setLoading(true);
      setError("");
      setMessage("");
      if (owner)
        void (async () => {
          try {
            const permission = (await cloudRequest("/permissions", {}, owner)) as {
              can_generate_reports?: boolean;
            };
            if (!active || permission.can_generate_reports !== true) return;
            setAuthorized(owner);
            const settings = await loadReportSettings(owner);
            if (active) {
              setValue(settings);
              setLoading(false);
            }
          } catch {
            if (active) setError("Report settings could not be loaded. Please retry.");
          }
        })();
      return () => {
        active = false;
      };
    }, [user?.uid, retry]),
  );
  async function chooseLogo() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const owner = user?.uid;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
      });
      if (cloudUid() !== owner || result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error("Choose a PNG or JPEG logo.");
      const data = asset.base64;
      const mime = data.startsWith("iVBOR")
        ? "image/png"
        : data.startsWith("/9j/")
          ? "image/jpeg"
          : null;
      if (!mime) throw new Error("Choose a PNG or JPEG logo.");
      if (data.length > 2796204) throw new Error("Choose a logo smaller than 2 MB.");
      setValue((current) => ({
        ...current,
        logo_data_url: `data:${mime};base64,${data}`,
      }));
    } catch (e) {
      if (cloudUid() === owner)
        setError(e instanceof Error ? e.message : "Could not select logo.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (lock.current || loading) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const owner = user?.uid;
    try {
      const saved = await saveReportSettings(value, owner);
      if (cloudUid() === owner) {
        setValue(saved);
        setMessage("Report settings saved.");
      }
    } catch {
      if (cloudUid() === owner)
        setError(
          "Could not save report settings. Check the logo is PNG/JPEG and smaller than 2 MB, then retry.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!user || authorized !== user.uid) return null;
  return (
    <Card style={{ gap: 14 }}>
      <Label>Report Settings</Label>
      {!!error && <WarningMessage text={error} error />}
      {loading ? (
        <>
          <Body>Loading report settings…</Body>
          {!!error && <Button title="Retry" onPress={() => setRetry((n) => n + 1)} />}
        </>
      ) : (
        <>
          {value.logo_data_url && (
            <Image
              accessibilityLabel="Company logo preview"
              source={{ uri: value.logo_data_url }}
              style={{ width: "100%", height: 100 }}
              resizeMode="contain"
            />
          )}
          <Button
            title={value.logo_data_url ? "Replace logo" : "Upload logo"}
            secondary
            disabled={busy}
            onPress={() => void chooseLogo()}
          />
          {value.logo_data_url && (
            <Button
              title="Remove logo"
              secondary
              disabled={busy}
              onPress={() => {
                setValue((v) => ({ ...v, logo_data_url: null }));
                setMessage("");
              }}
            />
          )}
          <Body>PNG or JPEG, up to 2 MB.</Body>
          {(
            [
              ["company_name", "Company name", 120],
              ["address", "Company address", 400],
              ["phone", "Phone", 50],
              ["email", "Company email", 150],
              ["website", "Website", 200],
              ["registration_number", "Registration number", 80],
            ] as const
          ).map(([key, label, max]) => (
            <View key={key} style={{ gap: 6 }}>
              <Body>{label}</Body>
              <TextInput
                accessibilityLabel={label}
                value={value[key]}
                maxLength={max}
                editable={!busy}
                multiline={key === "address"}
                autoCapitalize={
                  key === "email" || key === "website" ? "none" : "sentences"
                }
                onChangeText={(text) => {
                  setValue((v) => ({ ...v, [key]: text }));
                  setMessage("");
                }}
                style={{
                  borderWidth: 1,
                  borderColor: theme.line,
                  borderRadius: 10,
                  padding: 12,
                  color: theme.ink,
                  fontFamily: "Poppins_400Regular",
                }}
              />
            </View>
          ))}
          <Button
            title="Save report settings"
            busy={busy}
            disabled={busy}
            onPress={() => void save()}
          />
          {!!message && <Body>{message}</Body>}
        </>
      )}
    </Card>
  );
}
