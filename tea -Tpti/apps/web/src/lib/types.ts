// ============================================================
// 全局共享类型契约
// 所有 feature 依赖的基础类型（与 index.html 的数据结构一致）
// ============================================================

/** 五款茶的 id */
export type TeaId = 'duyun' | 'meitan' | 'zunyi' | 'puan' | 'leishan';

/** 全部屏幕 */
export type Screen =
  | 'launch'
  | 'swipe'
  | 'detail'
  | 'brew'
  | 'taste'
  | 'realm'
  | 'chapter'
  | 'ending'
  | 'profile'
  | 'teabti'
  | 'passport';

/** 底部导航三个 Tab */
export type Tab = 'swipe' | 'realm' | 'profile';

/** Swipe 动作 */
export type SwipeAction = 'like' | 'skip';

/** Reveal 关闭后的去向 */
export type RevealNext = 'detail' | 'swipe';

/** Blind Card 文案（先感觉、后术语的第一态） */
export interface TeaBlind {
  headline: string;
  desc: string;
  tags: string[];
  scene: string;
  art: string;
}

/** 专业侧信息（Reveal 后 / 详情页展示） */
export interface TeaPro {
  tags: string[];
  sensory: string;
  brewing: string;
  origin: string;
  process: string;
  translate: string;
}

/** 一款茶 */
export interface Tea {
  id: TeaId;
  name: string;
  region: string;
  type: string;
  emoji: string;
  blind: TeaBlind;
  pro: TeaPro;
}
