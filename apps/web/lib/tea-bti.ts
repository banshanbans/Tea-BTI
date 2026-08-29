import type { TeaBti } from "@/lib/api";

export const TEA_BTI_ENDPOINT_COPY: Record<string, string> = {
  F: "鲜爽、清亮、轻快。",
  M: "温润、圆融、有包裹感。",
  L: "入口轻，节奏明快。",
  R: "有厚度、有存在感，层次更深。",
  S: "先被香气吸引，再走进茶汤。",
  T: "关注入口、回味和茶汤变化。",
  E: "愿意把陌生风味留进下一杯。",
  C: "会回到已经确认喜欢的风味。",
};

export function teaBtiAxisPercent(score: number): number {
  return Math.max(4, Math.min(96, 50 - score * 46));
}

export function teaBtiStatusCopy(profile: TeaBti): string {
  const progress = profile.formationProgress;
  if (progress) {
    if (progress.swipesRemaining > 0) {
      return `身份正在形成 · 再留下 ${progress.swipesRemaining} 次选择，就会初步形成`;
    }
    return "初步轮廓已经形成 · 后续选择会继续校准";
  }
  return profile.state === "stable"
    ? "逐渐稳定 · 下一杯仍会让身份继续生长"
    : "初见 · 下一杯会让轮廓更清楚";
}
