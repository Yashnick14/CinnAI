import { z } from "zod";
import { API } from "../config/api";
export const ASSISTANT_ERROR =
  "Sorry, the assistant is temporarily unavailable. Please try again.";
export const AssistantResponseSchema = z.object({
  answer: z.string().trim().min(1),
  detected_diameter_mm: z.number().finite().positive().nullable(),
  application_grade: z
    .enum([
      "Alba",
      "C5 Special",
      "C5",
      "C4",
      "M5",
      "M4",
      "H1",
      "H2",
      "Manual Review",
    ])
    .nullable(),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
export async function askAssistant(
  question: string,
  signal?: AbortSignal,
): Promise<AssistantResponse> {
  const trimmed = question.trim();
  if (!trimmed || trimmed.length > 4000)
    throw new Error("Enter a question of up to 4,000 characters.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  if (signal?.aborted) cancel();
  // Includes time for the first encoder load and answer generation.
  const timer = setTimeout(cancel, 120_000);
  try {
    if (!/^https?:\/\//.test(API.baseUrl)) throw new Error();
    const response = await fetch(`${API.baseUrl}/assistant/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: trimmed }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error();
    return AssistantResponseSchema.parse(await response.json());
  } catch {
    throw new Error(ASSISTANT_ERROR);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
