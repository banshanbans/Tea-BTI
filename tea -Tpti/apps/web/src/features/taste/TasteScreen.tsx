'use client';

// ============================================================
// Screen 8 · Taste Mode（品茶陪伴）
// 迁移自 index.html 的 Screen 8 与 resetTaste / tasteSpeak / tasteRate / markTasted。
// 语音转文字与对话气泡为本地 UI 状态（store 的 tasteSpeak 是空操作），
// 评分走 store.tasteRate → 内部调用 markTasted（记入护照「已品」）。
// ============================================================
import { Fragment, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { TEAS } from '@/lib/teas';
import { BackButton } from '@/components/ui';

// 评分三档（value 与 index.html 的 tasteRate 参数一致）
const RATE_OPTIONS: { value: string; lines: string[] }[] = [
  { value: '比想象中喜欢', lines: ['比想象中', '喜欢'] },
  { value: '还行', lines: ['还行'] },
  { value: '不是我的菜', lines: ['不是我的菜'] },
];

// 气泡入场过渡（与 .fade-in 视觉节奏一致，用 framer-motion 驱动）
const bubbleIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/** 顶部引导语「喝一口。不用说专业词。」 */
export function TastePrompt() {
  return (
    <div className="taste-prompt">
      <h2>
        喝一口。
        <br />
        不用说专业词。
      </h2>
      <div className="q">“它让你想到什么？”</div>
    </div>
  );
}

/** 中央大麦克风按钮（点击进入语音气泡） */
export function TasteVoice({ onSpeak }: { onSpeak: () => void }) {
  return (
    <div className="taste-voice">
      <button className="micbtn" onClick={onSpeak} aria-label="按住说话">
        🎙
      </button>
      <div className="hint">点一下，用你自己的话说</div>
    </div>
  );
}

/** 语音转文字 + AI 翻译对话气泡 */
export function TasteThread({ thanks }: { thanks: boolean }) {
  return (
    <div className="taste-thread">
      <motion.div
        className="bubble user"
        initial={bubbleIn.initial}
        animate={bubbleIn.animate}
        transition={{ duration: 0.4 }}
      >
        有点像青草，
        <br />
        但没那么冲，喝完还有一点甜。
      </motion.div>
      <motion.div
        className="bubble ai"
        initial={bubbleIn.initial}
        animate={bubbleIn.animate}
        transition={{ duration: 0.4, delay: 0.12 }}
      >
        <b>我大概懂你的意思。</b>
        <br />
        你说的前半段接近：
        <div className="mini-tags">
          <span>清鲜</span>
          <span>嫩香</span>
        </div>
        后面的那点甜感：
        <div className="mini-tags">
          <span>回甘</span>
        </div>
      </motion.div>
      {thanks && (
        <motion.div
          className="bubble ai"
          initial={bubbleIn.initial}
          animate={bubbleIn.animate}
          transition={{ duration: 0.4 }}
        >
          记住了。下一杯会更懂你一点。
        </motion.div>
      )}
    </div>
  );
}

/** 评分区「这杯你喜欢吗？」三个按钮；评分后替换为感谢语 */
export function TasteRate({
  lastTaste,
  onRate,
}: {
  lastTaste: string | null;
  onRate: (val: string) => void;
}) {
  return (
    <div className="taste-rate">
      {lastTaste ? (
        <div className="taste-thanks">已记入这杯茶的记录 🍃</div>
      ) : (
        <>
          <div className="q">这杯你喜欢吗？</div>
          <div className="rate-row">
            {RATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className="rate-btn"
                onClick={() => onRate(opt.value)}
              >
                {opt.lines.map((line, i) => (
                  <Fragment key={line}>
                    {i > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Screen 8 · Taste Mode 默认导出 */
export default function TasteScreen() {
  const currentTea = useAppStore((s) => s.currentTea);
  const lastTaste = useAppStore((s) => s.lastTaste);
  const go = useAppStore((s) => s.go);
  const tasteSpeak = useAppStore((s) => s.tasteSpeak);
  const tasteRate = useAppStore((s) => s.tasteRate);

  const [spoken, setSpoken] = useState(false);

  const teaName = TEAS[currentTea]?.name ?? '都匀毛尖';

  const handleSpeak = () => {
    tasteSpeak();
    setSpoken(true);
  };

  return (
    <section className="screen screen-scroll screen-taste active">
      <div className="statusbar"></div>
      <div className="taste-head">
        <BackButton onClick={() => go('detail')} />
        <div className="ttitle">
          {teaName}
          <small>品茶陪伴</small>
        </div>
      </div>

      <TastePrompt />

      {!spoken && <TasteVoice onSpeak={handleSpeak} />}
      {spoken && <TasteThread thanks={lastTaste !== null} />}
      {spoken && <TasteRate lastTaste={lastTaste} onRate={tasteRate} />}

      <div style={{ height: 'calc(var(--tab-h) + var(--safe-b) + 10px)' }}></div>
    </section>
  );
}
