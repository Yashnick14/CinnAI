import { expect, it } from "vitest";
import { emptyReportSettings } from "../src/config/reportSettings";
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
