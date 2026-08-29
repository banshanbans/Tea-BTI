// ============================================================
// Mock Data —— 五款茶（逐字迁移自 index.html 的 TEAS 对象）
// ============================================================
import type { Tea, TeaId } from './types';

export const TEAS: Record<TeaId, Tea> = {
  duyun: {
    id: 'duyun', name: '都匀毛尖', region: '贵州 · 黔南', type: '绿茶', emoji: '🍃',
    blind: { headline: '清一点。', desc: '像刚冒出来的嫩叶，\n尾巴还会留一点甜。', tags: ['轻盈','清鲜','回甘'], scene: '适合刚睡醒的周末上午', art: 'mist' },
    pro: { tags: ['绿茶','栗香','鲜爽','回甘'], sensory: '栗香清高，滋味鲜爽，回甘明显。', brewing: '玻璃杯或盖碗 · 约 80–85°C · 第一泡 20 秒左右。', origin: '贵州省黔南州，高海拔多雾山地茶园。', process: '杀青 → 揉捻 → 干燥，一芽一叶或一芽二叶。', translate: '你刚刚说的「清、嫩、尾巴有点甜」，在茶的语言里，大概就是这一挂。' }
  },
  meitan: {
    id: 'meitan', name: '湄潭翠芽', region: '贵州 · 遵义', type: '绿茶', emoji: '🌱',
    blind: { headline: '甜香先到。', desc: '有味道，但不厚重。\n下午想喝点东西的时候刚好。', tags: ['甜香','鲜爽','柔和'], scene: '适合午后的那一口', art: 'leaf' },
    pro: { tags: ['绿茶','甜香','鲜爽','柔和'], sensory: '甜香清雅，滋味鲜爽柔和。', brewing: '玻璃杯 · 约 85°C · 上投法，1–2 分钟。', origin: '贵州省遵义市湄潭县，云雾缭绕的茶区。', process: '摊青 → 杀青 → 理条 → 干燥。', translate: '你说的「甜香、不厚重」，茶里常叫「鲜爽 + 清甜」。' }
  },
  zunyi: {
    id: 'zunyi', name: '遵义红', region: '贵州 · 遵义', type: '红茶', emoji: '🍂',
    blind: { headline: '这一杯更有存在感。', desc: '稍微厚一点，\n尾韵会停得久一点。', tags: ['醇厚','温熟','绵长'], scene: '适合慢慢坐下来的傍晚', art: 'amber' },
    pro: { tags: ['红茶','甜香','醇厚','绵长'], sensory: '甜香明显，滋味醇和，尾韵绵长。', brewing: '盖碗或壶 · 约 90°C · 快进快出。', origin: '贵州省遵义市，高山生态茶园。', process: '萎凋 → 揉捻 → 发酵 → 干燥。', translate: '你说的「厚、尾韵久」，在红茶里通常叫「醇厚 + 绵长」。' }
  },
  puan: {
    id: 'puan', name: '普安红', region: '贵州 · 黔西南', type: '红茶', emoji: '🍁',
    blind: { headline: '暖一点。', desc: '像晒过太阳的叶子，\n喝下去是踏实的甜。', tags: ['甜润','温熟','干净'], scene: '适合有点凉的日子', art: 'amber' },
    pro: { tags: ['红茶','甜润','温熟','干净'], sensory: '甜润温顺，汤色红亮，干净利落。', brewing: '盖碗 · 约 90°C · 快进快出。', origin: '贵州省黔西南州普安县，高海拔茶区。', process: '萎凋 → 揉捻 → 发酵 → 干燥。', translate: '你说的「暖、踏实甜」，接近「甜润 + 温熟」。' }
  },
  leishan: {
    id: 'leishan', name: '雷山银球茶', region: '贵州 · 黔东南', type: '绿茶', emoji: '🫒',
    blind: { headline: '很干净的一口。', desc: '没有什么多余的东西，\n像山里的清泉。', tags: ['干净','清鲜','轻盈'], scene: '适合想安静下来的时刻', art: 'mist' },
    pro: { tags: ['绿茶','银球','清鲜','干净'], sensory: '清香悠长，滋味清鲜干净。', brewing: '玻璃杯 · 约 85°C · 球型茶可稍久。', origin: '贵州省黔东南州雷山县，云雾高山。', process: '杀青 → 揉捻 → 成球 → 干燥。', translate: '你说的「干净、像清泉」，就是「清鲜 + 干净」。' }
  }
};

/** Swipe Feed 的顺序（循环队列） */
export const FEED_ORDER: TeaId[] = ['duyun', 'meitan', 'zunyi', 'puan', 'leishan'];
