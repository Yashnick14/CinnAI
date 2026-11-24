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
  includeNonExportQuality = true,
) {
  const unique = new Map(records.map((record) => [record.id, record]));
  const selected = [...unique.values()].filter((record) => {
    const at = Date.parse(record.timestamp);
    return (
      (includeNonExportQuality ||
        (record.finalGrade != null &&
          record.moistureStatus === "PASS" &&
          record.moistureRawAdc != null &&
          Number.isFinite(record.moistureRawAdc) &&
          record.moistureRawAdc >= 0 &&
          record.moistureRawAdc < ADC_UNTOUCHED_THRESHOLD &&
          (record.moisturePercent == null ||
            (Number.isFinite(record.moisturePercent) &&
              record.moisturePercent >= 0 &&
              record.moisturePercent <= 14)))) &&
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

/** Build the printable report using saved company visibility preferences. */
export function qualityReportHtml(
  records: GradingResult[],
  range: ReportRange,
  account: string,
  generatedAt = new Date(),
  settings?: ReportSettings,
) {
  const branding = settings ? ReportSettingsSchema.parse(settings) : undefined;
  const report = summarizeQuality(
    records,
    range,
    generatedAt,
    branding?.include_non_export_quality ?? false,
  );
  const logo =
    branding?.show_logo && branding.logo_data_url
      ? `<td class="logo-cell"><img alt="Company logo" src="${branding.logo_data_url}"></td>`
      : "";
  const details: [string, string][] = [];
  if (branding) {
    for (const [key, label] of [
      ["company_name", "Company name"],
      ["address", "Address"],
      ["phone", "Phone"],
      ["email", "Email"],
    ] as const) {
      if (branding[`show_${key}`] && branding[key].trim())
        details.push([label, branding[key]]);
    }
  }
  details.push(
    [
      "Records",
      branding?.include_non_export_quality
        ? "All saved assessments"
        : "Moisture-compliant graded assessments",
    ],
    ["Report period", range.label],
    ["Prepared for", account],
    ["Generated", generatedAt.toLocaleString()],
    ["Time zone", Intl.DateTimeFormat().resolvedOptions().timeZone],
  );
  const detailRows = [];
  for (let i = 0; i < details.length; i += 2) {
    detailRows.push(
      `<tr>${details
        .slice(i, i + 2)
        .map(
          ([label, value]) =>
            `<td><strong>${escapeReportText(label)}:</strong> <span>${escapeReportText(value)}</span></td>`,
        )
        .join("")}${i + 1 === details.length ? "<td></td>" : ""}</tr>`,
    );
  }
  const rows = report.rows
    .map(
      (row) =>
        `<tr><td>${escapeReportText(row.grade)}</td><td>${row.assessments}</td><td>${row.quills}</td><td>${row.pass}</td><td>${row.fail}</td><td>${row.unavailable}</td></tr>`,
    )
    .join("");
  const totals = report.rows.reduce(
    (total, row) => ({
      assessments: total.assessments + row.assessments,
      quills: total.quills + row.quills,
      pass: total.pass + row.pass,
      fail: total.fail + row.fail,
      unavailable: total.unavailable + row.unavailable,
    }),
    { assessments: 0, quills: 0, pass: 0, fail: 0, unavailable: 0 },
  );
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CinnAI Quality Report</title><style>
  @page {size:A4; margin:16mm;}
  *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#29221d;font-size:11px;line-height:1.45;margin:0}
  table{width:100%;border-collapse:collapse;table-layout:fixed} td,th{border:1px solid #d8cfc5;padding:8px;overflow-wrap:anywhere}
  .heading{break-inside:avoid;border-bottom:7px solid #80502f}.masthead td{padding:0;text-align:center}
  .masthead .logo-cell{width:27%;padding:12px}.logo-cell img{max-width:100%;max-height:78px;object-fit:contain}
  h1{background:#80502f;color:white;font-size:22px;letter-spacing:1px;margin:0;padding:14px 8px;text-transform:uppercase}
  .subtitle{font-size:17px;font-weight:bold;padding:10px;text-transform:uppercase}
  .details td{width:50%;vertical-align:top;padding:6px 9px}.details strong{color:#80502f}.details span{white-space:pre-line}
  h2{background:#80502f;color:white;font-size:12px;font-weight:600;padding:6px 9px;margin:22px 0 0}
  .summary th{background:#f6f0e9;font-weight:normal}.summary td{text-align:center;font-size:18px;font-weight:bold;color:#80502f}
  .grades th{background:#f6f0e9;font-weight:600}.grades td,.grades th{text-align:center}.grades td:first-child{text-align:left;font-weight:600}
  .grades tbody tr:nth-child(even){background:#faf7f3}.grades tfoot td{background:#f6f0e9;font-weight:bold}
  thead{display:table-header-group} tr{break-inside:avoid}.section{break-inside:avoid}
  .note,footer{font-size:9px;color:#72685e;line-height:1.5}.note{margin:8px 0}footer{border-top:2px solid #80502f;margin-top:20px;padding-top:9px}
  </style></head><body>
  <header class="heading"><table class="masthead"><tr>${logo}<td><h1>Quality report</h1><div class="subtitle">Cinnamon quill grading</div></td></tr></table>
  <table class="details">${detailRows.join("")}</table></header>
  <section class="section"><h2>Assessment summary</h2><table class="summary"><thead><tr><th>Saved assessments</th><th>Quills in graded records</th><th>Manual reviews</th><th>Unassigned assessments</th></tr></thead><tbody><tr><td>${report.assessments}</td><td>${report.quills}</td><td>${report.manualReviews}</td><td>${report.unassigned}</td></tr></tbody></table></section>
  ${report.assessments ? "" : "<p>No saved assessments in this period.</p>"}
  <section class="section"><h2>Grade distribution &amp; moisture</h2><table class="grades"><thead><tr><th rowspan="2">Grade</th><th rowspan="2">Assessments</th><th rowspan="2">Detected quills</th><th colspan="3">Moisture</th></tr><tr><th>Comply</th><th>Non-comply</th><th>Unavailable</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>Total</td><td>${totals.assessments}</td><td>${totals.quills}</td><td>${totals.pass}</td><td>${totals.fail}</td><td>${totals.unavailable}</td></tr></tfoot></table></section>
  <p class="note">Moisture columns count assessments by their saved application result. Comply and Non-comply reflect the configured sensor threshold, not a laboratory measurement or certification. Missing and untouched readings are listed as Unavailable.</p>
  <footer>Includes saved database assessments for the selected graders within the selected dates, through generation time. Grades reflect the saved final assessment, including recorded manual reviews.</footer></body></html>`;
}
