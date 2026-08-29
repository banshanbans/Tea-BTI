'use client';

// ============================================================
// RevealSheet —— 喜欢后的 Bottom Sheet：茶名 / 产区 / 专业标签 / 翻译
// 进出场用 framer-motion（scrim 淡入淡出 + sheet 上滑）。
// ============================================================
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { TEAS } from '@/lib/teas';

const SHEET_EASE: [number, number, number, number] = [0.22, 0.9, 0.3, 1];

export default function RevealSheet() {
  const revealTea = useAppStore((s) => s.revealTea);
  const closeReveal = useAppStore((s) => s.closeReveal);
  const tea = revealTea ? TEAS[revealTea] : null;

  return (
    <AnimatePresence>
      {tea && (
        <motion.div
          key="reveal"
          className="overlay"
          style={{ visibility: 'visible', pointerEvents: 'auto', transition: 'none' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="scrim" onClick={() => closeReveal('swipe')} />
          <motion.div
            className="sheet reveal-sheet"
            style={{ transition: 'none' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.42, ease: SHEET_EASE }}
          >
            <div className="grabber"></div>
            <div className="reveal-eyebrow eyebrow">你刚刚喜欢的是</div>
            <div className="reveal-name">{tea.name}</div>
            <div className="reveal-region">{tea.region}</div>
            <div className="reveal-tags">
              {tea.pro.tags.map((x) => (
                <span key={x} className="tag">
                  {x}
                </span>
              ))}
            </div>
            <div className="reveal-translate">{tea.pro.translate}</div>
            <div className="reveal-actions">
              <button className="btn btn-ghost" onClick={() => closeReveal('swipe')}>
                继续刷
              </button>
              <button className="btn btn-primary" onClick={() => closeReveal('detail')}>
                看看这杯
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
