import { describe, expect, it } from "vitest";

import { tasteTagLabel } from "./taste-language";

describe("tasteTagLabel", () => {
  it("turns every supported API tag into user-facing Chinese tea language", () => {
    expect([
      "fresh", "tender_aroma", "floral", "fruity", "sweet",
      "mellow", "astringent", "clean", "aftertaste_sweetness",
    ].map(tasteTagLabel)).toEqual([
      "清鲜", "嫩香", "花香", "果香", "甜润",
      "醇和", "涩感", "干净", "回甘",
    ]);
  });

  it("never exposes an unknown internal field name", () => {
    expect(tasteTagLabel("future_internal_tag")).toBe("其他感受");
  });
});
