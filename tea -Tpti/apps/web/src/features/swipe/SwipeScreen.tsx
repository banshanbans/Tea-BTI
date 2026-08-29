'use client';

// ============================================================
// SwipeScreen —— Screen 2 · Blind Swipe（盲品刷茶）
// 头部标题 + 计数器 + ? 帮助气泡；卡片堆叠；想喝/下一杯按钮；Reveal 与 Summary 覆盖层。
// ============================================================
import { useAppStore } from '@/stores/app-store';
import { FEED_ORDER } from '@/lib/teas';
import BlindCard from './BlindCard';
import SwipeDeck from './SwipeDeck';
import RevealSheet from './RevealSheet';
import TasteSummary from './TasteSummary';

export { BlindCard, SwipeDeck, RevealSheet, TasteSummary };

export default function SwipeScreen() {
  const swipeCount = useAppStore((s) => s.swipeCount);
  const helpOpen = useAppStore((s) => s.helpOpen);
  const toggleHelp = useAppStore((s) => s.toggleHelp);
  const swipe = useAppStore((s) => s.swipe);

  const counter = (swipeCount % FEED_ORDER.length) + 1;

  return (
    <section className="screen screen-swipe active">
      <div className="statusbar"></div>
      <div className="swipe-head">
        <div className="title">刷茶</div>
        <div className="counter">
          <b>{counter}</b> / {FEED_ORDER.length}
        </div>
        <div className="iconbtn" style={{ position: 'relative' }} onClick={toggleHelp}>
          <span style={{ fontWeight: 700 }}>?</span>
          <div className={`help-pop${helpOpen ? ' show' : ''}`}>
            现在不会告诉你茶名。先凭感觉选——「想喝」还是「下一杯」。
          </div>
        </div>
      </div>

      <SwipeDeck />

      <div className="swipe-actions">
        <button className="act act-skip" aria-label="下一杯" onClick={() => swipe('skip')}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <button className="act act-like" aria-label="想喝" onClick={() => swipe('like')}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 21C12 21 4 14.5 4 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 2.5C20 14.5 12 21 12 21Z" />
          </svg>
        </button>
      </div>

      <RevealSheet />
      <TasteSummary />
    </section>
  );
}
