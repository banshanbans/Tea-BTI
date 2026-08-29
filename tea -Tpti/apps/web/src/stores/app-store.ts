// ============================================================
// App 全局状态（Zustand）
// 迁移自 index.html 的 App 对象：状态字段与动作逻辑一一对应。
// DOM 侧逻辑（innerHTML / classList）由各 feature 组件负责，这里只保留状态等价逻辑。
// ============================================================
import { create } from 'zustand';
import { FEED_ORDER } from '@/lib/teas';
import {
  fetchPassport,
  fetchTeaBti,
  isBackendHealthy,
  postSwipe,
  type PassportEntry,
  type TeaBtiResponse,
} from '@/lib/api';
import type { Screen, SwipeAction, Tab, TeaId, RevealNext } from '@/lib/types';

// ----------------------------------------------------------------------------
// 内容常量（迁移自 index.html 中与行为耦合的文案数组）
// ----------------------------------------------------------------------------

/** Taste Summary 正面标签 */
export const SUMMARY_POS_TAGS: string[] = ['清', '鲜', '有一点甜'];
/** Taste Summary 负面标签 */
export const SUMMARY_NEG_TAGS: string[] = ['浓', '厚', '尾韵特别重'];

/** Brew Mode 五个步骤文案 */
export const BREW_STEPS: string[] = ['投茶', '注水', '等待', '出汤', '完成'];
/** Brew Mode 每个步骤的状态文案 */
export const BREW_STATE_TEXTS: string[] = ['正在投茶', '正在注水', '等待中', '正在出汤', '完成'];
/** Brew Mode AI 茶伴每步说的话 */
export const BREW_SAYS: string[] = [
  '把茶叶轻轻放进去，大概铺满盖碗底部。',
  '水流沿着碗壁缓缓注入，别对着叶子冲。',
  '这一泡等 20 秒左右，让鲜爽感出来。',
  '差不多可以出汤了。',
  '这杯泡好了，趁热喝。',
];
/** Brew Mode 「为什么？」展开答案 */
export const BREW_WHYS: string[] = [
  '投茶量不用太满，盖碗留点空间让叶子舒展。',
  '沿壁注水能避免水温直接冲击嫩芽。',
  '短一些能保留鲜爽感，久了容易闷。',
  '再等会涩感会重，现在出汤最清甜。',
  '',
];

/** Tea Realm「一叶成茶」四阶段文案 */
export interface ChapterStage {
  stage: string;
  goal: string;
  tip: string;
  who: string;
  head: string;
  txt: string;
  btn: string;
  icon: string;
}

export const CHAPTER_DATA: ChapterStage[] = [
  { stage: '生长', goal: '让它长出来。', tip: '点击云雾，让茶芽苏醒', who: '', head: '让它长出来。', txt: '贵州山地与多雾环境，让茶树在这里形成自己的生长节奏。', btn: '继续', icon: '🌱' },
  { stage: '采摘', goal: '摘下这一芽。', tip: '点一下最嫩的芽', who: '', head: '摘下这一芽。', txt: '你刚刚采下的是一芽一叶。', btn: '继续', icon: '🍃' },
  { stage: '制茶', goal: '让它成为茶。', tip: '连续点击翻炒，完成杀青', who: '', head: '让它成为茶。', txt: '这一道工序改变了叶子的香气与状态。', btn: '继续', icon: '🔥' },
  { stage: '人与故事', goal: '听它说。', tip: '点击继续', who: '制茶师', head: '', txt: '「我第一次守这口锅的时候，也把茶炒焦过。」<br/>「后来才明白，每一锅都有自己的脾气。」', btn: '完成', icon: '👋' },
];

/** 屏幕 → 底部 Tab 的映射（launch 无映射，保持原 tab） */
const TAB_MAP: Partial<Record<Screen, Tab>> = {
  swipe: 'swipe', detail: 'swipe', brew: 'swipe', taste: 'swipe',
  realm: 'realm', chapter: 'realm', ending: 'realm',
  profile: 'profile', teabti: 'profile', passport: 'profile',
};

// ----------------------------------------------------------------------------
// 状态与动作类型
// ----------------------------------------------------------------------------

export interface AppState {
  currentScreen: Screen;
  currentTab: Tab;
  feedIdx: number;
  swipeCount: number;
  likes: TeaId[];
  skips: TeaId[];
  currentTea: TeaId;
  brewStep: number;
  chapter: number;
  chapterDone: boolean[];
  passport: TeaId[];
  revealTea: TeaId | null;
  showSummary: boolean;
  showCompanion: boolean;
  helpOpen: boolean;
  /** 最近一次品茶评价（tasteRate） */
  lastTaste: string | null;
  /** 轻提示文案（toast） */
  toastMessage: string | null;
  /** 后端是否在线（/health 可达） */
  backendOnline: boolean;
  /** 后端 Tea-BTI（在线时非空，离线为 null 走本地 mock） */
  backendTeaBti: TeaBtiResponse | null;
  /** 后端茶护照（在线时非空，离线为 null 走本地 mock） */
  backendPassport: PassportEntry[] | null;
}

export interface AppActions {
  go(screen: Screen): void;
  tab(name: Tab): void;
  swipe(action: SwipeAction): void;
  openReveal(teaId: TeaId): void;
  closeReveal(next: RevealNext): void;
  openSummary(): void;
  closeSummary(again: boolean): void;
  openDetail(id: TeaId): void;
  enterBrew(): void;
  brewNext(): void;
  resetTaste(): void;
  tasteSpeak(): void;
  tasteRate(val: string): void;
  markTasted(): void;
  openCompanion(): void;
  closeCompanion(): void;
  startChapter(): void;
  chapterNext(): void;
  addPassport(): void;
  toggleHelp(): void;
  setScreen(name: Screen): void;
  toast(msg: string): void;
  /** 检测后端可用性并拉取 Tea-BTI / 护照（失败降级到 mock） */
  hydrateFromBackend(): Promise<void>;
}

export type AppStore = AppState & AppActions;

// 会话级标志（非响应式状态）
let _summaryShown = false;
let _toastTimer: ReturnType<typeof setTimeout> | undefined;

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useAppStore = create<AppStore>()((set, get) => ({
  // ----- 状态 -----
  currentScreen: 'launch',
  currentTab: 'swipe',
  feedIdx: 0,
  swipeCount: 0,
  likes: [],
  skips: [],
  currentTea: 'duyun',
  brewStep: 2,
  chapter: 0,
  chapterDone: [false, false, false, false],
  passport: [],
  revealTea: null,
  showSummary: false,
  showCompanion: false,
  helpOpen: false,
  lastTaste: null,
  toastMessage: null,
  backendOnline: false,
  backendTeaBti: null,
  backendPassport: null,

  // ----- 屏幕路由 -----
  go: (screen) => {
    const { openDetail, enterBrew, resetTaste, startChapter } = get();
    if (screen === 'detail') openDetail(get().currentTea);
    if (screen === 'brew') enterBrew();
    if (screen === 'taste') resetTaste();
    if (screen === 'chapter') startChapter();
    set({ currentScreen: screen });
    const tab = TAB_MAP[screen];
    if (tab) set({ currentTab: tab });
  },

  setScreen: (name) => set({ currentScreen: name }),

  tab: (name) => {
    const map: Record<Tab, Screen> = { swipe: 'swipe', realm: 'realm', profile: 'profile' };
    set({ currentTab: name, currentScreen: map[name] });
  },

  // ----- Swipe -----
  swipe: (action) => {
    const { feedIdx, swipeCount, likes, skips } = get();
    const topId = FEED_ORDER[feedIdx % FEED_ORDER.length];
    const nextFeedIdx = (feedIdx + 1) % FEED_ORDER.length;
    const nextSwipeCount = swipeCount + 1;

    // 后端联调：在线时 fire-and-forget 上报（不阻塞 UI，失败静默降级）
    if (get().backendOnline) {
      postSwipe(topId, action).catch(() => {});
    }

    if (action === 'like') {
      set({
        likes: [...likes, topId],
        feedIdx: nextFeedIdx,
        swipeCount: nextSwipeCount,
        currentTea: topId,
        revealTea: topId,
      });
    } else {
      set({
        skips: [...skips, topId],
        feedIdx: nextFeedIdx,
        swipeCount: nextSwipeCount,
      });
      if (nextSwipeCount >= 5 && !_summaryShown) {
        _summaryShown = true;
        setTimeout(() => set({ showSummary: true }), 350);
      }
    }
  },

  // ----- Reveal -----
  openReveal: (teaId) => set({ currentTea: teaId, revealTea: teaId }),

  closeReveal: (next) => {
    set({ revealTea: null });
    if (next === 'detail') {
      set({ currentScreen: 'detail', currentTab: 'swipe' });
    } else if (get().swipeCount >= 5 && !_summaryShown) {
      _summaryShown = true;
      setTimeout(() => set({ showSummary: true }), 350);
    }
  },

  // ----- Summary -----
  openSummary: () => set({ showSummary: true }),

  closeSummary: (again) => {
    set({ showSummary: false });
    if (again) {
      // 继续刷：无额外状态变更（原 renderSwipe 为 DOM 逻辑）
    } else {
      set({ currentTea: 'duyun', currentScreen: 'detail', currentTab: 'swipe' });
    }
  },

  // ----- Detail -----
  openDetail: (id) => set({ currentTea: id }),

  // ----- Brew -----
  enterBrew: () => set({ brewStep: 2 }),

  brewNext: () => {
    const next = Math.min(4, get().brewStep + 1);
    set({ brewStep: next });
    if (next >= 4) {
      get().toast('这一泡结束 · 已记入记录');
      setTimeout(() => get().go('detail'), 700);
    }
  },

  // ----- Taste -----
  resetTaste: () => set({ lastTaste: null }),

  // 语音转文字与对话气泡由 feature/taste 组件本地管理；store 无持久状态变更。
  tasteSpeak: () => {},

  tasteRate: (val) => {
    set({ lastTaste: val });
    get().markTasted();
  },

  markTasted: () => {
    const id = get().currentTea;
    if (!get().passport.includes(id)) {
      set({ passport: [...get().passport, id] });
    }
  },

  // ----- Companion -----
  openCompanion: () => set({ showCompanion: true }),
  closeCompanion: () => set({ showCompanion: false }),

  // ----- Realm -----
  startChapter: () =>
    set({
      chapter: 0,
      chapterDone: [false, false, false, false],
      currentScreen: 'chapter',
      currentTab: 'realm',
    }),

  chapterNext: () => {
    const { chapter, chapterDone } = get();
    const nextDone = [...chapterDone];
    nextDone[chapter] = true;
    if (chapter < 3) {
      set({ chapterDone: nextDone, chapter: chapter + 1 });
    } else {
      set({ chapterDone: nextDone, currentScreen: 'ending', currentTab: 'realm' });
    }
  },

  // ----- Passport -----
  addPassport: () => {
    if (!get().passport.includes('duyun')) {
      set({ passport: [...get().passport, 'duyun'] });
    }
    get().toast('已收进茶护照 🛂');
    setTimeout(() => set({ currentScreen: 'passport', currentTab: 'profile' }), 500);
  },

  // ----- 帮助 / Toast -----
  toggleHelp: () => set({ helpOpen: !get().helpOpen }),

  toast: (msg) => {
    set({ toastMessage: msg });
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => set({ toastMessage: null }), 1800);
  },

  // ----- 后端联通 -----
  hydrateFromBackend: async () => {
    try {
      const online = await isBackendHealthy();
      set({ backendOnline: online });
      if (!online) return;
      const [teabti, passport] = await Promise.all([
        fetchTeaBti().catch(() => null),
        fetchPassport().catch(() => null),
      ]);
      set({ backendTeaBti: teabti, backendPassport: passport });
    } catch {
      set({ backendOnline: false });
    }
  },
}));
