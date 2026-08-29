import { describe, expect, it } from "vitest";

import {
  recognizeCircle,
  recognizeForwardPush,
  recognizePekoeMulti,
  recognizePekoeSingle,
  recognizeRolling,
  recognizeTiltAlternations,
} from "./craftGestureRecognizer";

const point = (x: number, y: number, time: number) => ({ x, y, time });

describe("Tea Realm craft gesture recognizers", () => {
  it("accepts three deliberate tilt alternations and rejects one-way motion", () => {
    expect(recognizeTiltAlternations([7, -8, 9, -7]).matched).toBe(true);
    expect(recognizeTiltAlternations([7, 9, 10, 12]).matched).toBe(false);
  });

  it("accepts a deliberate vertical push in either natural screen direction", () => {
    expect(recognizeForwardPush([point(50, 180, 0), point(54, 65, 500)], 200, 300).matched).toBe(true);
    expect(recognizeForwardPush([point(20, 180, 0), point(170, 150, 500)], 200, 300).matched).toBe(false);
  });

  it("recognizes horizontal rolling reversals and rejects vertical random movement", () => {
    const rolling = [20, 100, 25, 110, 30, 120, 35].map((x, index) => point(x, 100 + index % 2, index * 100));
    const random = [point(20, 20, 0), point(25, 130, 100), point(30, 40, 200), point(32, 160, 300), point(35, 60, 400), point(38, 170, 500)];
    expect(recognizeRolling(rolling, 200, 240).matched).toBe(true);
    expect(recognizeRolling(random, 200, 240).matched).toBe(false);
    const smooth = [20, 24, 28, 32, 36, 40, 36, 32, 28, 24, 20, 24, 28, 32, 36, 40, 36, 32, 28, 24, 20]
      .map((x, index) => point(x, 100 + index % 2, index * 20));
    expect(recognizeRolling(smooth, 100, 180).matched).toBe(true);
    const sparse = [20, 80, 20, 80].map((x, index) => point(x, 100, index * 80));
    expect(recognizeRolling(sparse, 100, 180).matched).toBe(true);
  });

  it("recognizes a closed circle near 360 degrees and rejects a small loop", () => {
    const circle = Array.from({ length: 25 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2;
      return point(100 + Math.cos(angle) * 70, 100 + Math.sin(angle) * 60, index * 30);
    });
    const small = circle.map((item) => point(100 + (item.x - 100) * 0.2, 100 + (item.y - 100) * 0.2, item.time));
    expect(recognizeCircle(circle, 240, 240).matched).toBe(true);
    expect(recognizeCircle(small, 240, 240).matched).toBe(false);
  });

  it("keeps two-finger pekoe distinct from the single-finger fallback", () => {
    const first = [50, 65, 48, 66, 47, 67, 46].map((x, index) => point(x, 80, index * 120));
    const second = [150, 135, 152, 134, 153, 133, 154].map((x, index) => point(x, 82, index * 120));
    const single = [100, 125, 95, 128, 94, 126, 96].map((y, index) => point(100, y, index * 100));
    expect(recognizePekoeMulti(first, second, 240).matched).toBe(true);
    expect(recognizePekoeSingle(single, 240).matched).toBe(true);
    expect(recognizePekoeMulti(first, [], 240).matched).toBe(false);
  });
});
