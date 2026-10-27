import { describe, it, expect } from "vitest";
import { captureGuides, captureGeometry } from "../src/config/captureGuides";
describe("controlled capture mapping", () => {
  it("keeps the coin square and guides separated on different phone previews", () => {
    for (const view of [
      { width: 390, height: 520 },
      { width: 390, height: 700 },
    ]) {
      const { coin, quill } = captureGuides(view);
      expect(coin.width * view.width).toBeCloseTo(coin.height * view.height);
      expect(coin.x + coin.width).toBeLessThan(quill.x);
      expect(quill.y + quill.height).toBeLessThanOrEqual(1);
    }
  });
  it("maps a processed portrait image without applying a second crop", () => {
    const g = captureGeometry({ width: 300, height: 400 }, 1200, 1600);
    expect(g.coin.x * g.image_width).toBeCloseTo(84);
    expect(g.coin.y * g.image_height).toBeCloseTo(864);
    expect(g.coin.width * g.image_width).toBeCloseTo(384);
    expect(g.coin.height * g.image_height).toBeCloseTo(384);
  });
  it("rejects incompatible image aspect ratios", () => {
    expect(() =>
      captureGeometry({ width: 300, height: 400 }, 1600, 1200),
    ).toThrow("dimensions");
  });
});
