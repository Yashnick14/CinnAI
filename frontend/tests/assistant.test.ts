import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/config/api", () => ({
  API: { baseUrl: "http://192.168.10.10:8000" },
}));
import { askAssistant, ASSISTANT_ERROR } from "../src/services/assistantApi";
import { createAssistantConversation } from "../src/services/assistantConversation";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const result = {
  answer: "Preparation guidance.",
  detected_diameter_mm: null,
  application_grade: null,
};
it.each([
  ["How can I produce Alba quality cinnamon quills?", result],
  [
    "My cinnamon quill diameter is 19.4 mm. What grade is it and why?",
    {
      answer: "M4 is the application grade.",
      detected_diameter_mm: 19.4,
      application_grade: "M4",
    },
  ],
  [
    "My cinnamon quill diameter is exactly 21 mm. What grade is it?",
    {
      answer: "Manual Review is required.",
      detected_diameter_mm: 21,
      application_grade: "Manual Review",
    },
  ],
])(
  "displays the backend answer and metadata for %s",
  async (question, payload) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetcher);
    const chat = createAssistantConversation();
    const request = chat.send(` ${question} `);
    expect(chat.getSnapshot().messages[0]!.text).toBe(question);
    expect(chat.getSnapshot().pending).toBe(true);
    await request;
    expect(chat.getSnapshot().messages[1]!.result).toEqual(payload);
    expect(fetcher.mock.calls[0]![0]).toBe(
      "http://192.168.10.10:8000/assistant/ask",
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ question });
  },
);
it("does not send empty input or duplicate requests", async () => {
  let resolve!: (r: typeof result) => void;
  const request = vi.fn(
    () =>
      new Promise<typeof result>((r) => {
        resolve = r;
      }),
  );
  const chat = createAssistantConversation(request);
  expect(await chat.send("  ")).toBe(false);
  const first = chat.send("Alba?");
  expect(await chat.send("Second?")).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
  resolve(result);
  await first;
});
it("retains multiple messages in order and notifies subscribers", async () => {
  const chat = createAssistantConversation(async () => result);
  const listener = vi.fn();
  const stop = chat.subscribe(listener);
  await chat.send("First?");
  await chat.send("Second?");
  expect(chat.getSnapshot().messages.map((m) => m.text)).toEqual([
    "First?",
    result.answer,
    "Second?",
    result.answer,
  ]);
  expect(listener).toHaveBeenCalledTimes(4);
  stop();
});
it.each([502, 503, 500, 404])("hides HTTP %s details", async (status) => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ detail: "secret provider error" }),
      }),
  );
  const chat = createAssistantConversation();
  await chat.send("Alba?");
  expect(chat.getSnapshot().error).toBe(ASSISTANT_ERROR);
  expect(chat.getSnapshot().pending).toBe(false);
  expect(chat.getSnapshot().messages).toHaveLength(1);
});
it.each([
  {},
  { ...result, answer: "" },
  { ...result, detected_diameter_mm: "19.4" },
  { ...result, application_grade: "made-up" },
])("rejects malformed responses", async (payload) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
  );
  await expect(askAssistant("Alba?")).rejects.toThrow(ASSISTANT_ERROR);
});
it("handles offline requests", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("network detail")),
  );
  await expect(askAssistant("Alba?")).rejects.toThrow(ASSISTANT_ERROR);
});
it("aborts timed out requests with a friendly error", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    ),
  );
  const assertion = expect(askAssistant("Alba?")).rejects.toThrow(
    ASSISTANT_ERROR,
  );
  await vi.advanceTimersByTimeAsync(120_000);
  await assertion;
});
it("cancels on screen disposal without adding a late reply", async () => {
  let resolve!: (r: typeof result) => void;
  const chat = createAssistantConversation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const sent = chat.send("Alba?");
  chat.cancel();
  resolve(result);
  await sent;
  expect(chat.getSnapshot().messages).toHaveLength(1);
});

