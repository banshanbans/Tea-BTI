export const MBTI_OPTIONS = [
  { code: "INFJ", line: "安静听见细节，也在意一件事的来处。" },
  { code: "INFP", line: "跟着心里的微光，认真喜欢，也认真感受。" },
  { code: "ENFJ", line: "愿意让人靠近，也把温度留在相处里。" },
  { code: "ENFP", line: "新鲜的风一来，就想跟着去看看。" },
  { code: "INTJ", line: "心里有路，喜欢把复杂的事慢慢理清。" },
  { code: "INTP", line: "总想多看一层，让答案自己浮出来。" },
  { code: "ENTJ", line: "方向一明，就愿意带着事情往前走。" },
  { code: "ENTP", line: "一有新想法，眼睛就亮了。" },
  { code: "ISFJ", line: "记得细小的好，也把照顾放进日常。" },
  { code: "ISTJ", line: "把每一步放稳，日子自然有了秩序。" },
  { code: "ESFJ", line: "喜欢把热闹照顾妥帖，也让人安心。" },
  { code: "ESTJ", line: "看清目标，便利落地把事情做成。" },
  { code: "ISFP", line: "不急着定义，先留住当下的感觉。" },
  { code: "ISTP", line: "先动手，再让答案从过程里出现。" },
  { code: "ESFP", line: "喜欢热气腾腾的现场，也愿意分享快乐。" },
  { code: "ESTP", line: "风往哪儿吹，就往哪儿多走一步。" },
] as const;

export const HOME_COPY = {
  retryTitle: "茶席还没准备好",
  retryAction: "再试一次",
  mbtiTitle: "找到你的 MBTI",
  mbtiIntro: "挑一个，看看哪三杯会先来找你。",
  mbtiSharedIntro: "你原来的记录都在。挑一个，我们重新开场。",
  mbtiConfirm: "就选这个",
  mbtiSkip: "还没测过？先凭感觉开始",
  seedTitle: "三杯茶，先来见你。",
  seedIntro: "一杯像你，一杯意外，还有一杯换个方向。",
  seedPrimary: "开始刷茶",
  revealEyebrow: "这一杯是",
  recommendationTitle: "这一杯，想让你先喝。",
  feedProgress: (count: number) => `第 ${count} 杯`,
} as const;

export const COMMON_COPY = {
  loadingPassport: "茶护照正在翻开…",
  loadingProfile: "正在整理你的茶主页…",
  loadingRealm: "雾从杯里升起来…",
  retry: "再试一次",
} as const;

export const TEA_BTI_AXES = [
  { key: "freshMellow", left: { code: "F", label: "清鲜" }, right: { code: "M", label: "醇和" } },
  { key: "lightRich", left: { code: "L", label: "轻盈" }, right: { code: "R", label: "浓郁" } },
  { key: "scentTaste", left: { code: "S", label: "香气先行" }, right: { code: "T", label: "滋味先行" } },
  { key: "explorerComfort", left: { code: "E", label: "尝新" }, right: { code: "C", label: "守味" } },
] as const;
