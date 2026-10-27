import { z } from "zod";
import { DecisionSchema } from "../types/decision";
export const ProgressSchema = z.object({
  type: z.literal("progress"),
  step: z.enum(["detector", "visual", "diameter", "decision"]),
  state: z.enum(["running", "passed", "failed", "unavailable"]),
});
export type ValidationProgress = z.infer<typeof ProgressSchema>;
export async function readValidationStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onProgress?: (event: ValidationProgress) => void,
) {
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "progress")
          onProgress?.(ProgressSchema.parse(event));
        else if (event.type === "result")
          return DecisionSchema.parse(event.result);
        else
          throw new Error("Validation could not complete. Retry the analysis.");
      }
      if (done)
        throw new Error(
          "Validation connection ended before all checks completed. No grade assigned.",
        );
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
