import { expect, it } from "vitest";
import {
  emptyReportSettings,
  ReportSettingsSchema,
} from "../src/config/reportSettings";
import { qualityReportHtml, reportRange } from "../src/services/qualityReport";
it("escapes company details and supports an embedded logo", () => {
  const now = new Date();
  const html = qualityReportHtml([], reportRange("day", now), "Admin", now, {
    ...emptyReportSettings,
    company_name: "Company <script>alert(1)</script>",
    address: "Road & City",
    logo_data_url: "data:image/png;base64,aGVsbG8=",
  });
  expect(html).toContain("Company &lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("Road &amp; City");
  expect(html).toContain('alt="Company logo"');
});
it("rejects external logo URLs", () => {
  const now = new Date();
  expect(() =>
    qualityReportHtml([], reportRange("day", now), "Admin", now, {
      ...emptyReportSettings,
      logo_data_url: "https://example.com/logo.png",
    }),
  ).toThrow();
});

it("defaults existing saved settings to visible and hides each disabled detail", () => {
  const now = new Date();
  const values = {
    ...emptyReportSettings,
    company_name: "UNIQUE_COMPANY",
    address: "UNIQUE_ADDRESS",
    phone: "UNIQUE_PHONE",
    email: "UNIQUE_EMAIL",
    website: "OLD_WEBSITE",
    registration_number: "OLD_REGISTRATION",
    logo_data_url: "data:image/png;base64,aGVsbG8=",
  };
  for (const key of ["company_name", "address", "phone", "email"] as const) {
    const html = qualityReportHtml([], reportRange("day", now), "Admin", now, {
      ...values,
      [`show_${key}`]: false,
    });
    expect(html).not.toContain(values[key]);
    expect(html).not.toContain("OLD_WEBSITE");
    expect(html).not.toContain("OLD_REGISTRATION");
    for (const other of ["company_name", "address", "phone", "email"] as const)
      if (other !== key) expect(html).toContain(values[other]);
  }
  expect(
    qualityReportHtml([], reportRange("day", now), "Admin", now, {
      ...values,
      show_logo: false,
    }),
  ).not.toContain('alt="Company logo"');
  const legacy = Object.fromEntries(
    Object.entries(values).filter(([key]) => !key.startsWith("show_")),
  );
  const parsed = ReportSettingsSchema.parse(legacy);
  expect(parsed.show_logo).toBe(true);
  expect(parsed.show_company_name).toBe(true);
});

it("defaults export-quality filtering off for non-compliant records and honours inclusion", () => {
  expect(emptyReportSettings.include_non_export_quality).toBe(false);
  const now = new Date();
  const record = {
    id: "wet",
    timestamp: now.toISOString(),
    isMock: false,
    source: "api",
    finalGrade: "M4",
    detectedQuillCount: 1,
    moistureStatus: "FAIL",
    moistureRawAdc: 1600,
  } as import("../src/types/grading").GradingResult;
  expect(
    qualityReportHtml(
      [record],
      reportRange("day", now),
      "Admin",
      now,
      emptyReportSettings,
    ),
  ).toContain("No saved assessments");
  expect(
    qualityReportHtml([record], reportRange("day", now), "Admin", now, {
      ...emptyReportSettings,
      include_non_export_quality: true,
    }),
  ).not.toContain("No saved assessments");
});

it("accepts exactly 10 MB of base64 logo data and rejects one extra byte", () => {
  const bytes = 10 * 1024 * 1024;
  const encode = (size: number) =>
    "data:image/png;base64," + Buffer.alloc(size).toString("base64");
  expect(
    ReportSettingsSchema.safeParse({
      ...emptyReportSettings,
      email: "quality@example.com",
      logo_data_url: encode(bytes),
    }).success,
  ).toBe(true);
  expect(
    ReportSettingsSchema.safeParse({
      ...emptyReportSettings,
      logo_data_url: encode(bytes + 1),
    }).success,
  ).toBe(false);
});
