'use client';

// ============================================================
// 浮动「茶伴」按钮 + AI Companion Drawer（bottom sheet）
// 浮动按钮在 launch / brew / taste 隐藏，其余屏幕显示。
// ============================================================
import { Fragment, useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { TEAS } from '@/lib/teas';

// 快捷问题答案映射（迁移自 index.html 的 companionAnswer）
const COMPANION_ANSWERS: Record<string, string> = {
  '下一泡怎么调整？': '这一泡你可以稍微延长 5 秒左右，甜感和回甘会更明显。',
  '我上次怎么形容它？': '你上次说「像雨后的嫩草，第二泡更甜」。我把「清鲜 + 回甘」记在护照里了。',
  '为什么会有栗香？': '都匀毛尖在炒制时的高温会带出类似板栗的香气，是它很标志性的味道。',
};

const COMPANION_FALLBACK = '这一泡可以试试。';

const QUICK_QUESTIONS = ['下一泡怎么调整？', '我上次怎么形容它？', '为什么会有栗香？'];

interface Message {
  q: string;
  a: string;
}

export default function FloatingCompanion() {
  const currentScreen = useAppStore((s) => s.currentScreen);
  const showCompanion = useAppStore((s) => s.showCompanion);
  const currentTea = useAppStore((s) => s.currentTea);
  const openCompanion = useAppStore((s) => s.openCompanion);
  const closeCompanion = useAppStore((s) => s.closeCompanion);

  const [messages, setMessages] = useState<Message[]>([]);
  const [answered, setAnswered] = useState<string[]>([]);

  // 浮动按钮可见性（对应 index.html 的 syncFloat）
  const showFloat = !['launch', 'brew', 'taste'].includes(currentScreen);
  const teaName = TEAS[currentTea]?.name ?? '都匀毛尖';

  const handleOpen = () => {
    setMessages([]);
    openCompanion();
  };

  const handleQuick = (q: string) => {
    if (answered.includes(q)) return;
    const a = COMPANION_ANSWERS[q] ?? COMPANION_FALLBACK;
    setMessages([{ q, a }]);
    setAnswered((prev) => [...prev, q]);
  };

  return (
    <>
      {showFloat && (
        <button className="float-companion" onClick={handleOpen}>
          <span className="fc-av">🍃</span>
          茶伴
          <span className="fc-dot"></span>
        </button>
      )}

      <div className={`overlay${showCompanion ? ' show' : ''}`}>
        <div className="scrim" onClick={closeCompanion}></div>
        <div className="sheet companion-sheet">
          <div className="grabber"></div>
          <div className="cm-head">
            <div className="av">🍃</div>
            <div>
              <div className="nm">茶伴</div>
              <div className="ctx">正在聊：{teaName}</div>
            </div>
            <button className="iconbtn cm-close" onClick={closeCompanion}>
              ✕
            </button>
          </div>
          <div className="cm-quick">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleQuick(q)}
                style={answered.includes(q) ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                {q}
              </button>
            ))}
          </div>
          <div className="cm-msg">
            {messages.map((m, i) => (
              <Fragment key={i}>
                <div className="bubble user">{m.q}</div>
                <div className="bubble ai">{m.a}</div>
              </Fragment>
            ))}
          </div>
          <div className="cm-history">查看这杯茶的历史记录 ›</div>
        </div>
      </div>
    </>
  );
}
