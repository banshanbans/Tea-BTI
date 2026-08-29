const TASTE_TAG_LABELS: Record<string, string> = {
  fresh: "清鲜",
  tender_aroma: "嫩香",
  floral: "花香",
  fruity: "果香",
  sweet: "甜润",
  mellow: "醇和",
  astringent: "涩感",
  clean: "干净",
  aftertaste_sweetness: "回甘",
};

export function tasteTagLabel(tag: string): string {
  return TASTE_TAG_LABELS[tag] ?? "其他感受";
}
