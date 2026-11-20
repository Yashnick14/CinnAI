import { z } from "zod";
import { cloudRequest, cloudUid } from "./cloudApi";
import { GradingResultSchema } from "../types/grading";

/** Obtain report data through admin-authorized endpoints, never normal history. */
export async function adminReportRecords(user = "", owner = cloudUid()) {
  const records = [];
  for (let offset = 0; ; offset += 100) {
    const page = z
      .array(z.object({ user_uid: z.string(), record: GradingResultSchema }))
      .parse(
        await cloudRequest(
          `/admin/report-records?offset=${offset}&limit=100${user ? `&user=${encodeURIComponent(user)}` : ""}`,
          {},
          owner,
        ),
      );
    // IDs are owner-scoped in the database; avoid cross-user deduplication collisions.
    records.push(
      ...page.map((item) => ({
        ...item.record,
        id: `${item.user_uid}:${item.record.id}`,
      })),
    );
    if (page.length < 100) return records;
  }
}
