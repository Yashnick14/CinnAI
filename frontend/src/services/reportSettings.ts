import { cloudRequest, cloudUid } from "./cloudApi";
import { ReportSettingsSchema, type ReportSettings } from "../config/reportSettings";
export { emptyReportSettings, type ReportSettings } from "../config/reportSettings";
/** Load only the authenticated administrator's saved PDF branding. */
export async function loadReportSettings(owner = cloudUid()) {
  return ReportSettingsSchema.parse(
    await cloudRequest("/admin/report-settings", {}, owner),
  );
}
/** Persist branding after server-side administrator and image validation. */
export async function saveReportSettings(value: ReportSettings, owner = cloudUid()) {
  return ReportSettingsSchema.parse(
    await cloudRequest(
      "/admin/report-settings",
      { method: "PUT", body: JSON.stringify(ReportSettingsSchema.parse(value)) },
      owner,
    ),
  );
}
