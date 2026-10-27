import { expect, it } from "vitest";
import { readValidationStream } from "../src/services/validationStream";

it("delivers progress before completion and handles split network chunks", async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      source = controller;
    },
  });
  const events: string[] = [];
  const completion = readValidationStream(stream.getReader(), (e) =>
    events.push(`${e.step}:${e.state}`),
  );
  const failed = expect(completion).rejects.toThrow("before all checks");
  const encoder = new TextEncoder();
  source.enqueue(encoder.encode('{"type":"progress","step":"detector",'));
  source.enqueue(encoder.encode('"state":"running"}\n'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(events).toEqual(["detector:running"]);
  source.enqueue(
    encoder.encode(
      '{"type":"progress","step":"detector","state":"passed"}\n{"type":"progress","step":"visual","state":"running"}\n',
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(events).toEqual([
    "detector:running",
    "detector:passed",
    "visual:running",
  ]);
  source.close();
  await failed;
});
