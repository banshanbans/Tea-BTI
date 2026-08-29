'use client';

// ============================================================
// Screen 11 · Tea Realm 一叶成茶 章节
// 四阶段：生长 / 采摘 / 制茶 / 人与故事
// ============================================================
import { Fragment, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, CHAPTER_DATA } from '@/stores/app-store';
import type { ChapterStage } from '@/stores/app-store';

// 四阶段场景 SVG（迁移自 index.html 的 chapterSceneSVG，path/rect 原样复用）
const SCENES: ReactNode[] = [
  // 生长：云雾 + 茶芽
  <svg key="grow" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="400" fill="#C7DFF0" />
    <path d="M0 300 L120 180 L240 300 Z" fill="#8FA974" />
    <path d="M160 320 L320 200 L400 300 L400 400 L0 400 Z" fill="#7A9660" />
    <ellipse cx="200" cy="120" rx="150" ry="40" fill="rgba(255,255,255,.6)" />
    <ellipse cx="90" cy="150" rx="110" ry="32" fill="rgba(255,255,255,.45)" />
    <g fill="#6F9A4E">
      <rect x="180" y="250" width="14" height="40" rx="6" />
      <rect x="205" y="242" width="14" height="48" rx="6" />
      <rect x="155" y="255" width="14" height="35" rx="6" />
    </g>
    <text x="200" y="90" textAnchor="middle" fontFamily="serif" fontSize="16" fill="rgba(31,61,43,.55)">
      点击云雾
    </text>
  </svg>,
  // 采摘：嫩芽
  <svg key="pick" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="400" fill="#DFEBD8" />
    <path d="M0 320 L200 240 L400 320 L400 400 L0 400 Z" fill="#8FA974" />
    <g fill="#557C3A">
      <rect x="80" y="270" width="20" height="60" rx="8" />
      <rect x="190" y="260" width="20" height="70" rx="8" />
      <rect x="300" y="275" width="20" height="55" rx="8" />
    </g>
    <g fill="#6F9A4E">
      <rect x="88" y="245" width="16" height="26" rx="6" />
      <rect x="198" y="235" width="16" height="26" rx="6" />
      <rect x="308" y="250" width="16" height="26" rx="6" />
    </g>
    <text x="200" y="90" textAnchor="middle" fontFamily="serif" fontSize="16" fill="rgba(31,61,43,.55)">
      点击最嫩的芽
    </text>
  </svg>,
  // 制茶：锅
  <svg key="pan" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="400" fill="#F0E4D0" />
    <circle cx="200" cy="210" r="120" fill="#3A3A3A" />
    <ellipse cx="200" cy="215" rx="100" ry="70" fill="#2A2A2A" />
    <g fill="#6F9A4E">
      <rect x="180" y="150" width="14" height="24" rx="5" />
      <rect x="200" y="146" width="14" height="26" rx="5" />
      <rect x="220" y="152" width="14" height="22" rx="5" />
    </g>
    <text x="200" y="350" textAnchor="middle" fontFamily="serif" fontSize="16" fill="rgba(31,61,43,.55)">
      连续点击翻炒
    </text>
  </svg>,
  // 人与故事
  <svg key="story" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="400" fill="#E9F0E0" />
    <circle cx="200" cy="170" r="40" fill="#E8D9B8" />
    <rect x="170" y="205" width="60" height="90" fill="#6F9A4E" rx="16" />
    <ellipse cx="200" cy="150" rx="70" ry="26" fill="rgba(255,255,255,.5)" />
    <text x="200" y="340" textAnchor="middle" fontFamily="serif" fontSize="16" fill="rgba(31,61,43,.55)">
      制茶师
    </text>
  </svg>,
];

/** 章节场景（SVG 铺满 .chapter-stage） */
export function ChapterScene({ index }: { index: number }) {
  return <div className="chapter-scene">{SCENES[index]}</div>;
}

/** 进度点（当前阶段及之前点亮） */
export function ChapterProgress({ chapter }: { chapter: number }) {
  return (
    <div className="chapter-progress">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`cp-dot${i <= chapter ? ' on' : ''}`} />
      ))}
    </div>
  );
}

/** 对话卡（who / head / txt） */
export function ChapterDialog({ data }: { data: ChapterStage }) {
  return (
    <div className="chapter-dialog">
      {data.who && <div className="who">{data.who}</div>}
      {data.head && <div className="dhead">{data.head}</div>}
      <div className="dtxt">
        {data.txt.split('<br/>').map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default function ChapterScreen() {
  const chapter = useAppStore((s) => s.chapter);
  const go = useAppStore((s) => s.go);
  const chapterNext = useAppStore((s) => s.chapterNext);

  const d = CHAPTER_DATA[chapter];

  // 点击场景推进（制茶阶段点锅等）；最后一阶段只能点底部按钮完成
  const handleStageTap = () => {
    if (chapter < 3) chapterNext();
  };

  return (
    <section className="screen screen-chapter active" data-screen="chapter">
      <div className="pagehead">
        <button className="back" onClick={() => go('realm')}>
          ←
        </button>
        <div className="ptitle">
          一叶成茶
          <small>
            {d.stage} · {chapter + 1} / 4
          </small>
        </div>
      </div>

      <ChapterProgress chapter={chapter} />

      <div className="chapter-stage" onClick={handleStageTap}>
        <AnimatePresence mode="wait">
          <motion.div
            key={chapter}
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <ChapterScene index={chapter} />
          </motion.div>
        </AnimatePresence>
        <div className="chapter-tap-hint" key={`hint-${chapter}`}>
          {d.tip}
        </div>
      </div>

      <ChapterDialog data={d} />

      <div className="chapter-foot">
        <button className="btn btn-primary" onClick={chapterNext}>
          {d.btn}
        </button>
      </div>
    </section>
  );
}
