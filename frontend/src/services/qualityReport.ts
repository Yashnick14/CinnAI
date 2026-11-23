import { ReportSettingsSchema, type ReportSettings } from "../config/reportSettings";
import { SUPPORTED_GRADES } from "../config/grading";
import { ADC_UNTOUCHED_THRESHOLD } from "../config/ble";
import type { GradingResult } from "../types/grading";

export type ReportPeriod = "day" | "week" | "month" | "custom";
export interface ReportRange {
  start: Date;
  end: Date;
  label: string;
}

/** Insert calendar separators while allowing backspace through an inserted dash. */
export function formatReportDateInput(value: string, previous = "") {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const deleting = value.length < previous.length;
  let formatted = digits.slice(0, 4);
  if (digits.length > 4 || (digits.length === 4 && !deleting)) formatted += "-";
  formatted += digits.slice(4, 6);
  if (digits.length > 6 || (digits.length === 6 && !deleting)) formatted += "-";
  return formatted + digits.slice(6);
}

/** Parse local calendar dates strictly, rejecting normalized dates such as February 31. */
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Use dates in YYYY-MM-DD format.");
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    throw new Error("Enter a valid calendar date.");
  return date;
}

/** Use local calendar days, inclusive start and exclusive next-day end. */
export function reportRange(
  period: ReportPeriod,
  now = new Date(),
  from = "",
  to = "",
): ReportRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = period === "custom" ? calendarDate(from) : new Date(today);
  const last = period === "custom" ? calendarDate(to) : new Date(today);
  if (period !== "custom")
    start.setDate(
      start.getDate() - (period === "week" ? 6 : period === "month" ? 29 : 0),
    );
  if (start > last)
    throw new Error("The start date must be on or before the end date.");
  const end = new Date(last);
  end.setDate(end.getDate() + 1);
  const format = (date: Date) =>
    date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  return { start, end, label: `${format(start)} - ${format(last)}` };
}

/** Aggregate saved real assessments without deriving moisture percentages from ADC. */
export function summarizeQuality(
  records: GradingResult[],
  range: ReportRange,
  generatedAt = new Date(),
) {
  const unique = new Map(records.map((record) => [record.id, record]));
  const selected = [...unique.values()].filter((record) => {
    const at = Date.parse(record.timestamp);
    return (
      !record.isMock &&
      record.source === "api" &&
      at >= +range.start &&
      at < +range.end &&
      at <= +generatedAt
    );
  });
  const average = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const rows = [...SUPPORTED_GRADES, "Unassigned" as const].map((grade) => {
    const group = selected.filter(
      (record) => (record.finalGrade ?? "Unassigned") === grade,
    );
    const readings = group.filter(
      (record) =>
        record.moistureStatus !== "UNAVAILABLE" &&
        record.moistureRawAdc != null &&
        Number.isFinite(record.moistureRawAdc) &&
        record.moistureRawAdc >= 0 &&
        record.moistureRawAdc < ADC_UNTOUCHED_THRESHOLD,
    );
    const percentages = readings
      .map((record) => record.moisturePercent)
      .filter(
        (value): value is number =>
          value != null && Number.isFinite(value) && value >= 0 && value <= 100,
      );
    return {
      grade,
      assessments: group.length,
      quills: group.reduce((sum, record) => sum + record.detectedQuillCount, 0),
      averageAdc: average(readings.map((record) => record.moistureRawAdc!)),
      averagePercent: average(percentages),
      readingCount: readings.length,
      percentageCount: percentages.length,
      pass: readings.filter((record) => record.moistureStatus === "PASS").length,
      fail: readings.filter((record) => record.moistureStatus === "FAIL").length,
      unavailable: group.length - readings.length,
    };
  });
  return {
    rows,
    assessments: selected.length,
    quills: rows
      .filter((row) => row.grade !== "Unassigned")
      .reduce((sum, row) => sum + row.quills, 0),
    unassigned: rows.find((row) => row.grade === "Unassigned")!.assessments,
    manualReviews: selected.filter((record) => !!record.manualReview).length,
  };
}

/** Escape account names and other text before inserting them into the report document. */
export function escapeReportText(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

/** Build a self-contained printable quality summary with explicit units and denominators. */
export function qualityReportHtml(
  records: GradingResult[],
  range: ReportRange,
  account: string,
  generatedAt = new Date(),
  settings?: ReportSettings,
) {
  const report = summarizeQuality(records, range, generatedAt);
  const branding = settings ? ReportSettingsSchema.parse(settings) : undefined;
  const company = branding
    ? `<div class="company">${branding.logo_data_url ? `<img alt="Company logo" class="company-logo" src="${branding.logo_data_url}">` : ""}<div class="brand">${escapeReportText(branding.company_name || "CinnAI")}</div>${[
        branding.address,
        branding.phone,
        branding.email,
        branding.website,
        branding.registration_number
          ? `Registration: ${branding.registration_number}`
          : "",
      ]
        .filter(Boolean)
        .map((line) => `<p class="muted">${escapeReportText(line)}</p>`)
        .join("")}</div>`
    : '<div class="brand">CinnAI</div>';
  const rows = report.rows
    .map(
      (row) =>
        `<tr><td><strong>${escapeReportText(row.grade)}</strong></td><td>${row.assessments}</td><td>${row.quills}</td><td>${row.pass}</td><td>${row.fail}</td><td>${row.unavailable}</td></tr>`,
    )
    .join("");
  const quality = report.rows
    .map(
      (row) =>
        `<tr><td>${escapeReportText(row.grade)}</td><td>${row.pass}</td><td>${row.fail}</td><td>${row.unavailable}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CinnAI Quality Report</title><style>
  @page {size:A4; margin:18mm;} *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#29221d;font-size:11px;line-height:1.5;margin:0} header{border-bottom:3px solid #80502f;padding-bottom:16px} .company-logo{max-width:180px;max-height:85px;object-fit:contain;display:block;margin-bottom:10px}.company p{white-space:pre-line}.brand{color:#80502f;font-size:25px;font-weight:700;letter-spacing:1px} h1{font-size:23px;margin:6px 0} h2{font-size:15px;color:#80502f;margin:24px 0 10px} p{margin:5px 0;overflow-wrap:anywhere} .muted{color:#72685e} .metrics{display:table;width:100%;margin:20px 0;background:#f6f0e9;border-radius:8px} .metric{display:table-cell;width:25%;padding:13px} .number{font-size:23px;font-weight:bold;color:#80502f;display:block} table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:10px} th{background:#80502f;color:white;font-weight:600} th,td{padding:9px 6px;text-align:right;border-bottom:1px solid #e5ded7;overflow-wrap:anywhere} th:first-child,td:first-child{text-align:left;width:19%} tbody tr:nth-child(even){background:#faf7f3} thead{display:table-header-group} tr{break-inside:avoid} .note{font-size:10px;color:#72685e;margin-top:10px} footer{border-top:1px solid #e5ded7;margin-top:20px;padding-top:10px;font-size:10px;color:#72685e} .section{break-inside:avoid}
  </style></head><body><header>${company}<h1>Grading quality report</h1><p>${escapeReportText(range.label)}</p><p class="muted">Prepared for ${escapeReportText(account)}</p><p class="muted">Generated ${escapeReportText(generatedAt.toLocaleString())} | ${escapeReportText(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p></header>
  <div class="metrics"><div class="metric"><span class="number">${report.assessments}</span>Saved assessments</div><div class="metric"><span class="number">${report.quills}</span>Quills in graded records</div><div class="metric"><span class="number">${report.manualReviews}</span>Manual reviews</div><div class="metric"><span class="number">${report.unassigned}</span>Unassigned assessments</div></div>
  ${report.assessments ? "" : "<p>No saved assessments in this period.</p>"}
  <section class="section"><h2>Grade distribution &amp; moisture screening</h2><table><thead><tr><th>Grade</th><th>Assessments</th><th>Detected quills</th><th>Screening ≤14%</th><th>Screening &gt;14%</th><th>Unavailable</th></tr></thead><tbody>${rows}</tbody></table></section>
  <p class="note">Moisture columns count assessments in application screening categories, not measured moisture percentages. Exact percentages and averages require calibrated measurements. Missing and untouched readings are excluded.</p>
  <section class="section"><h2>Moisture screening by grade</h2><table><thead><tr><th>Grade</th><th>Screening ≤14%</th><th>Screening &gt;14%</th><th>Unavailable</th></tr></thead><tbody>${quality}</tbody></table><p class="note">Counts refer to assessments. Saved screening results are preserved. ADC screening is not a calibrated moisture percentage or an export certificate.</p></section>
  <footer>Includes saved database assessments for the selected graders within the selected dates, through generation time. Grades reflect the saved final assessment, including recorded manual reviews.</footer></body></html>`;
}
