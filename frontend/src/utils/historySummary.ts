import type { GradingResult } from "../types/grading";

/** Choose the display label used for a saved record. */
export const recordLabel = (id: string) => `CG-${id.slice(0, 8).toUpperCase()}`;

/** Check whether a record timestamp falls on the current local calendar day. */
export function isToday(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** Calculate grading totals, average confidence and the most frequent grade. */
export function summarize(records: GradingResult[]) {
  const confidence = records.flatMap((r) =>
    r.visualConfidence === null ? [] : [r.visualConfidence],
  );
  const counts = new Map<string, number>();
  records.forEach((r) => {
    if (r.finalGrade) counts.set(r.finalGrade, (counts.get(r.finalGrade) ?? 0) + 1);
  });
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const common =
    sorted.length === 0
      ? null
      : sorted.length > 1 && sorted[0]![1] === sorted[1]![1]
        ? "Multiple grades"
        : sorted[0]![0];
  return {
    count: records.length,
    averageConfidence: confidence.length
      ? confidence.reduce((a, b) => a + b, 0) / confidence.length
      : null,
    common,
  };
}

/** Filter saved records by the requested search and grade/date criteria. */
export function filterHistory(
  records: GradingResult[],
  search: string,
  filter: string,
) {
  const query = search.toLowerCase().trim();
  return records.filter(
    (r) =>
      (filter === "All Grades" ||
        (filter === "Today" ? isToday(r.timestamp) : r.finalGrade === filter)) &&
      (!query ||
        [r.id, recordLabel(r.id), r.finalGrade, r.visualPrediction, r.finalStatus].some(
          (value) => value?.toLowerCase().includes(query),
        )),
  );
}
