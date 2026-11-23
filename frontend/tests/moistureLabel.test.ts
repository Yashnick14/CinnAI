import { expect, it } from "vitest";
import { moistureLabel } from "../src/utils/moistureLabel";
it("labels screening ranges without treating them as measured percentages", () => {
  expect(moistureLabel("PASS", 1800)).toBe("14% or below");
  expect(moistureLabel("FAIL_PROVISIONAL", 1650)).toBe("Above 14%");
  expect(moistureLabel("PASS", 2970)).toBe("Unavailable");
  expect(moistureLabel("UNAVAILABLE", 1800)).toBe("Unavailable");
  expect(moistureLabel("PASS", null)).toBe("Unavailable");
});
