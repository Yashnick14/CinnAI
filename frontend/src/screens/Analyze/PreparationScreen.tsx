import { useDesktopLayout } from "../../hooks/useDesktopLayout";
import { View } from "react-native";
import { Text } from "../../components/AppText";
import type { ScreenProps } from "../../types/navigation";
import {
  Button,
  Card,
  Heading,
  Label,
  Page,
  StatusBadge,
} from "../../components/ui";
import { theme } from "../../config/theme";

const steps = [
  "Place the sample on a white, flat surface.",
  "Place one quill at a time inside the quill guide and a Sri Lankan Rs.10 coin inside the coin guide for reference.",
  "Use bright, even lighting and avoid blur or strong shadows.",
  "Photograph straight from above.",
  "Review the captured photo, then tap Analyse.",
];
export function PreparationScreen({ navigation }: ScreenProps<"Preparation">) {
  const desktop = useDesktopLayout();
  return (
    <Page>
      <Heading
        title="Set up your sample."
        subtitle="Prepare a clear photo for the visual grading model."
      />
      <StatusBadge label="Visual analysis" tone="blue" />
      <View
        style={{
          flexDirection: desktop ? "row" : "column",
          gap: desktop ? 24 : 14,
          alignItems: "stretch",
        }}
      >
        <Card
          style={{
            flex: desktop ? 1.5 : undefined,
            gap: desktop ? 24 : 10,
            ...(desktop ? { padding: 28 } : {}),
          }}
        >
          {desktop && <Label>Capture checklist</Label>}
          {steps.map((text, i) => (
            <View key={text} style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ color: theme.accent, fontWeight: "800" }}>
                {i + 1}.
              </Text>
              <Text style={{ color: theme.ink, lineHeight: 23, flex: 1 }}>
                {text}
              </Text>
            </View>
          ))}
        </Card>
        <View
          style={{
            flex: desktop ? 1 : undefined,
            gap: 14,
            ...(desktop
              ? {
                  backgroundColor: theme.cream,
                  borderRadius: 16,
                  padding: 28,
                  borderWidth: 1,
                  borderColor: theme.line,
                  alignSelf: "flex-start" as const,
                }
              : {}),
          }}
        >
          {desktop && <Label>Ready to capture?</Label>}
          <Button
            title="Continue to Camera"
            onPress={() => navigation.navigate("Camera")}
          />
        </View>
      </View>
    </Page>
  );
}
