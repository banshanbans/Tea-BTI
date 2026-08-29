'use client';

// ============================================================
// Screen 6 · Tea Detail（茶详情）
// 迁移自 index.html Screen 6 与 App.openDetail 方法
// ============================================================
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useAppStore } from '@/stores/app-store';
import { TEAS } from '@/lib/teas';
import type { Screen, Tea } from '@/lib/types';
import { BackButton, Eyebrow, Tag } from '@/components/ui';

// 进场缓动（与 globals.css 的 .screen 过渡同风格）
const EASE: [number, number, number, number] = [0.22, 0.8, 0.28, 1];

/** 三个大动作卡（泡这杯 / 品这杯 / 看看它从哪里来） */
interface ActionCard {
  icon: string;
  ico: string;
  title: string;
  sub: string;
  screen: Screen;
}

const ACTION_CARDS: ActionCard[] = [
  { icon: '🫖', ico: 'brew', title: '泡这杯', sub: 'AI 在旁边看着你泡', screen: 'brew' },
  { icon: '🍵', ico: 'taste', title: '品这杯', sub: '不会形容也没关系', screen: 'taste' },
  { icon: '🌱', ico: 'realm', title: '看看它从哪里来', sub: '进入这片叶子背后的贵州', screen: 'realm' },
];

/** 下方 meta 行（感官 / 冲泡 / 地域 / 工艺） */
interface MetaRow {
  k: string;
  v: string;
}

function buildMeta(tea: Tea): MetaRow[] {
  return [
    { k: '感官', v: tea.pro.sensory },
    { k: '冲泡', v: tea.pro.brewing },
    { k: '地域', v: tea.pro.origin },
    { k: '工艺', v: tea.pro.process },
  ];
}

/** 轻量进出场 wrapper（用于内容区块依次浮现） */
function Reveal({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

interface PageHeadProps {
  region: string;
  onBack: () => void;
}

/** 页头：返回 + 茶详情 + 产区面包屑 */
export function PageHead({ region, onBack }: PageHeadProps) {
  return (
    <div className="pagehead">
      <BackButton onClick={onBack} aria-label="返回" />
      <div className="ptitle">
        茶详情
        <small>{region}</small>
      </div>
    </div>
  );
}

/** 首屏：眉注 / 茶名 / 产区 / 感官标签 */
export function DetailHero({ tea }: { tea: Tea }) {
  return (
    <div className="detail-hero">
      <Eyebrow>你刚刚喜欢的那一杯</Eyebrow>
      <h1>{tea.name}</h1>
      <div className="region">{tea.region}</div>
      <div className="hero-tags">
        {tea.pro.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
    </div>
  );
}

/** 极简茶叶视觉 */
export function DetailVisual({ emoji }: { emoji: string }) {
  return (
    <div className="detail-visual">
      <span className="leaf-emoji">{emoji}</span>
    </div>
  );
}

interface DetailActionsProps {
  onGo: (screen: Screen) => void;
}

/** 三个大动作卡 */
export function DetailActions({ onGo }: DetailActionsProps) {
  return (
    <div className="detail-actions">
      {ACTION_CARDS.map((c) => (
        <button key={c.screen} className="action-card" onClick={() => onGo(c.screen)}>
          <div className={`ico ${c.ico}`}>{c.icon}</div>
          <div>
            <div className="atitle">{c.title}</div>
            <div className="asub">{c.sub}</div>
          </div>
          <span className="arrow">›</span>
        </button>
      ))}
    </div>
  );
}

/** 下方 meta：感官 / 冲泡 / 地域 / 工艺 */
export function DetailMeta({ tea }: { tea: Tea }) {
  return (
    <div className="detail-meta">
      {buildMeta(tea).map((m) => (
        <div className="meta-row" key={m.k}>
          <div className="k">{m.k}</div>
          <div className="v">{m.v}</div>
        </div>
      ))}
    </div>
  );
}

/** Screen 6 默认导出：从 store.currentTea 读当前茶 */
export default function DetailScreen() {
  const currentTea = useAppStore((s) => s.currentTea);
  const go = useAppStore((s) => s.go);
  const tea = TEAS[currentTea] ?? TEAS.duyun;

  return (
    <section className="screen screen-scroll screen-detail active">
      <div className="statusbar"></div>
      <PageHead region={tea.region} onBack={() => go('swipe')} />
      <Reveal>
        <DetailHero tea={tea} />
      </Reveal>
      <Reveal delay={0.06}>
        <DetailVisual emoji={tea.emoji} />
      </Reveal>
      <Reveal delay={0.12}>
        <DetailActions onGo={go} />
      </Reveal>
      <Reveal delay={0.18}>
        <DetailMeta tea={tea} />
      </Reveal>
    </section>
  );
}
