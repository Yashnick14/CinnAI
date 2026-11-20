import { APP } from "../../config/app";
import { REFERENCE_COIN_DIAMETER_MM, SUPPORTED_GRADES } from "../../config/grading";
import { Body, Card, Heading, Label, Page, Row } from "../../components/ui";

/** Show concise application information and supported grading references. */
export function SettingsScreen() {
  return (
    <Page>
      <Heading title="Settings & About" />
      <Card>
        <Label>{APP.title}</Label>
        <Row label="App version" value={APP.version} />
      </Card>
      <Card>
        <Label>Supported grades</Label>
        <Body>{SUPPORTED_GRADES.join(" · ")}</Body>
        <Row
          label="Reference coin diameter"
          value={`${REFERENCE_COIN_DIAMETER_MM} mm`}
        />
      </Card>
      <Card>
        <Label>Grading</Label>
        <Body>
          Grades are based on diameter. Use manual review when an assessment needs
          further inspection.
        </Body>
      </Card>
    </Page>
  );
}
