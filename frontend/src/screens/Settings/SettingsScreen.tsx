import { APP } from "../../config/app";
import { API } from "../../config/api";
import { BLE } from "../../config/ble";
import {
  REFERENCE_COIN_DIAMETER_MM,
  SUPPORTED_GRADES,
} from "../../config/grading";
import {
  Body,
  Card,
  Heading,
  Label,
  Page,
  Row,
  WarningMessage,
} from "../../components/ui";
export function SettingsScreen() {
  return (
    <Page>
      <Heading eyebrow="PROJECT INFORMATION" title="Settings & About." />
      <Card>
        <Label>{APP.title}</Label>
        <Row label="App version" value={APP.version} />
        <Row label="Model version" value={APP.modelVersion} />
        <Row label="Mobile workflow" value="local_mock (camera phase)" />
        <Row label="Future API setting" value={API.mode} />
        <Row label="Sensor mode" value={BLE.mode} />
        <Row
          label="Backend"
          value={API.baseUrl || "Not configured"}
        />
        <Body>
          The current capture flow always uses the explicit local mock service.
          API settings are retained as a clean integration point for the later
          backend phase.
        </Body>
      </Card>
      <Card>
        <Label>Supported prototype grades</Label>
        <Body>{SUPPORTED_GRADES.join(" · ")}</Body>
        <WarningMessage text="C3 and H3 are unavailable because labelled training samples were not available." />
        <Row
          label="Reference coin diameter"
          value={`${REFERENCE_COIN_DIAMETER_MM} mm`}
        />
      </Card>
      <Card>
        <Label>Prototype limitations</Label>
        <Body>
          Models and measurement code are pending integration. Current results
          are explicitly labelled simulated data.
        </Body>
        <Body>
          The training dataset is highly imbalanced. M5 has very few examples,
          and minority-grade performance is lower than majority-grade
          performance.
        </Body>
        <Body>
          Physical diameter measurement depends on correct coin placement and
          approximately planar capture.
        </Body>
        <Body>
          Surface features are general texture measurements, not separately
          validated blemish or foxing classes.
        </Body>
        <Body>
          This is an academic prototype. Uncertain cases require manual review.
        </Body>
      </Card>
    </Page>
  );
}
