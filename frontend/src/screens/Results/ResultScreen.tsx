import { SaveAssessment } from "../../components/SaveAssessment";
import { Image } from "react-native";
import { Text } from "../../components/AppText";
import {
  Body,
  Card,
  Label,
  Button,
  Heading,
  Page,
  WarningMessage,
} from "../../components/ui";
import { CapturedPhoto } from "../../components/CapturedPhoto";
import { displayedGrade } from "../../types/decision";
import type { ScreenProps } from "../../types/navigation";
import { finalSummary } from "../../services/finalSummary";
import { SessionMoistureCard } from "../../components/SessionMoistureCard";

/** Present the official result alongside diameter, visual and moisture evidence. */
export function ResultScreen({ navigation, route }: ScreenProps<"Result">) {
  const result = route.params.result;
  const grade = displayedGrade(result);
  const diameter = result.diagnostics.diameter;
  const summary = finalSummary(result);
  return (
    <Page>
      <Heading
        title={`Sample ${result.status}`}
        subtitle={
          /sample verified|grade is based on/i.test(result.message)
            ? undefined
            : result.message
        }
      />
      <CapturedPhoto uri={result.imageUri} height={180} />
      {grade && diameter ? (
        <>
          <Text style={{ fontWeight: "700", fontSize: 28 }}>Grade: {grade}</Text>
          <Text>Diameter: {diameter.quill_diameter_mm.toFixed(2)} mm</Text>
          <SessionMoistureCard reading={result.moisture} />
          <Card>
            <Label>Final summary</Label>
            <Body>Grade: {summary.grade}</Body>
            <Body>Export Quality: {summary.exportQuality}</Body>
          </Card>
          {result.visual_disagreement && (
            <WarningMessage text="Visual evidence differs from the diameter grade." />
          )}
          {result.diagnostics.visual && (
            <Text style={{ fontSize: 13 }}>
              Supporting visual prediction:{" "}
              {result.diagnostics.visual.visual_prediction} (
              {(result.diagnostics.visual.visual_confidence * 100).toFixed(1)}%
              confidence).
            </Text>
          )}
          <Image
            accessibilityLabel="Coin and quill measurement overlay"
            source={{ uri: diameter.diagnostic_overlay }}
            style={{ width: "100%", height: 360 }}
            resizeMode="contain"
          />
        </>
      ) : (
        <WarningMessage text="No grade assigned. Recapture with one complete cinnamon quill and the Rs.10 coin clearly visible, or request manual review." />
      )}
      <Button
        title="Analyse Another Sample"
        secondary
        onPress={() =>
          navigation.reset({
            index: 1,
            routes: [{ name: "Home" }, { name: "Preparation" }],
          })
        }
      />
      <Button
        title="Manual Review"
        secondary
        onPress={() => navigation.navigate("ManualReview", { result })}
      />
      <SaveAssessment
        result={result}
        onHistory={() => navigation.navigate("History")}
      />
    </Page>
  );
}
