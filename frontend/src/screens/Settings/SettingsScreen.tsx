import { ReportSettingsCard } from "../../components/ReportSettingsCard";
import { APP } from "../../config/app";
import { REFERENCE_COIN_DIAMETER_MM, SUPPORTED_GRADES } from "../../config/grading";
import { Body, Card, Heading, Label, Page, Row } from "../../components/ui";

/** Show concise application information and supported grading references. */
export function SettingsScreen() {
  return (
    <Page>
      <Heading title="Settings & About" />
      <ReportSettingsCard />
      <Card style={{ gap: 12 }}>
        <Label>About</Label>
        <Body>{APP.title}</Body>
        <Row label="App version" value={APP.version} />
        <Body>Supported grades: {SUPPORTED_GRADES.join(" · ")}</Body>
        <Row
          label="Reference coin diameter"
          value={`${REFERENCE_COIN_DIAMETER_MM} mm`}
        />

        <Body>
          Grades are based on diameter. Use manual review when an assessment needs
          further inspection.
        </Body>
      </Card>
    </Page>
  );
}
