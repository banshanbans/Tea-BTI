'use client';

// ============================================================
// TasteSummary —— 5 次后「我开始有点懂你了」Summary Sheet
// 复刻 index.html 的 summaryOverlay（静态推荐「都匀毛尖 · 贵州 · 黔南」）。
// ============================================================
import { AnimatePresence, motion } from 'framer-motion';
import { SUMMARY_NEG_TAGS, SUMMARY_POS_TAGS, useAppStore } from '@/stores/app-store';

const SHEET_EASE: [number, number, number, number] = [0.22, 0.9, 0.3, 1];

export default function TasteSummary() {
  const showSummary = useAppStore((s) => s.showSummary);
  const closeSummary = useAppStore((s) => s.closeSummary);

  return (
    <AnimatePresence>
      {showSummary && (
        <motion.div
          key="summary"
          className="overlay"
          style={{ visibility: 'visible', pointerEvents: 'auto', transition: 'none' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="scrim" onClick={() => closeSummary(false)} />
          <motion.div
            className="sheet summary-sheet"
            style={{ transition: 'none' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.42, ease: SHEET_EASE }}
          >
            <div className="grabber"></div>
            <div className="summary-eyebrow eyebrow">RECOMMENDATION · 我开始有点懂你了</div>
            <div className="summary-title">
              我开始
              <br />
              有点懂你了。
            </div>
            <div className="summary-block">
              <div className="lbl">你连续留下了</div>
              <div className="summary-pillrow">
                {SUMMARY_POS_TAGS.map((x) => (
                  <span key={x} className="summary-pill pos">
                    {x}
                  </span>
                ))}
              </div>
            </div>
            <div className="summary-block">
              <div className="lbl">但两次跳过了</div>
              <div className="summary-pillrow">
                {SUMMARY_NEG_TAGS.map((x) => (
                  <span key={x} className="summary-pill neg">
                    {x}
                  </span>
                ))}
              </div>
            </div>
            <div className="summary-reco">
              <div className="reco-lbl">目前最想让你试的一杯</div>
              <div className="reco-name">都匀毛尖</div>
              <div className="reco-region">贵州 · 黔南</div>
            </div>
            <div className="summary-actions">
              <button className="btn btn-ghost" onClick={() => closeSummary(true)}>
                再刷几杯
              </button>
              <button className="btn btn-primary" onClick={() => closeSummary(false)}>
                喝这杯 →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
