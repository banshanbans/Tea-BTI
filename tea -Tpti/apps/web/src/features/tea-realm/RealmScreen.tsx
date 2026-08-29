'use client';

// ============================================================
// Screen 10 · Tea Realm 首页
// 标题 + 2.5D 像素茶山 SVG + 已解锁卡 + 未解锁提示
// ============================================================
import { useAppStore } from '@/stores/app-store';

/** 2.5D 像素茶山 SVG（迁移自 index.html 的 realmSVG，path/rect 原样复用） */
export function RealmWorld() {
  return (
    <div className="realm-world">
      <svg
        viewBox="0 0 400 320"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C7DFF0" />
            <stop offset="1" stopColor="#DFEBD8" />
          </linearGradient>
        </defs>
        <rect width="400" height="320" fill="url(#sky)" />
        {/* 雾 */}
        <ellipse cx="120" cy="70" rx="130" ry="30" fill="rgba(255,255,255,.55)" />
        <ellipse cx="300" cy="95" rx="140" ry="34" fill="rgba(255,255,255,.45)" />
        {/* 远山 */}
        <path d="M0 190 L70 120 L150 190 Z" fill="rgba(111,154,78,.35)" />
        <path d="M220 200 L300 130 L400 200 Z" fill="rgba(111,154,78,.3)" />
        {/* 茶园阶梯（像素感） */}
        <g>
          <path d="M0 210 L400 210 L400 240 L0 240 Z" fill="#A8C08B" />
          <path d="M0 242 L400 242 L400 272 L0 272 Z" fill="#8FA974" />
          <path d="M0 274 L400 274 L400 320 L0 320 Z" fill="#7A9660" />
        </g>
        {/* 茶树点（像素块） */}
        <g fill="#557C3A">
          <rect x="30" y="196" width="16" height="14" rx="3" />
          <rect x="70" y="192" width="16" height="14" rx="3" />
          <rect x="110" y="196" width="16" height="14" rx="3" />
          <rect x="150" y="190" width="16" height="14" rx="3" />
          <rect x="190" y="194" width="16" height="14" rx="3" />
          <rect x="230" y="190" width="16" height="14" rx="3" />
          <rect x="270" y="194" width="16" height="14" rx="3" />
          <rect x="310" y="192" width="16" height="14" rx="3" />
          <rect x="350" y="196" width="16" height="14" rx="3" />
        </g>
        <g fill="#6F9A4E">
          <rect x="50" y="226" width="18" height="16" rx="3" />
          <rect x="100" y="222" width="18" height="16" rx="3" />
          <rect x="150" y="226" width="18" height="16" rx="3" />
          <rect x="200" y="222" width="18" height="16" rx="3" />
          <rect x="250" y="226" width="18" height="16" rx="3" />
          <rect x="300" y="222" width="18" height="16" rx="3" />
        </g>
        {/* 小屋 */}
        <g>
          <rect x="268" y="150" width="44" height="34" fill="#E8D9B8" rx="3" />
          <path d="M262 152 L290 128 L318 152 Z" fill="#A87B3F" />
          <rect x="284" y="164" width="12" height="20" fill="#557C3A" />
        </g>
        {/* 人物 */}
        <g>
          <circle cx="180" cy="238" r="8" fill="#E8D9B8" />
          <rect x="174" y="246" width="12" height="16" fill="#6F9A4E" rx="4" />
        </g>
        <text
          x="24"
          y="30"
          fontFamily="serif"
          fontSize="12"
          fill="rgba(31,61,43,.5)"
          letterSpacing="2"
        >
          GUIZHOU · 贵州茶山
        </text>
      </svg>
    </div>
  );
}

/** 已解锁的都匀毛尖卡（进入一叶成茶） */
export function RealmUnlockedCard({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="realm-unlocked">
      <div className="lbl">已解锁</div>
      <button className="realm-card" onClick={onEnter}>
        <div className="rc-ico">🍃</div>
        <div>
          <div className="rc-name">都匀毛尖</div>
          <div className="rc-sub">贵州 · 黔南 · 一叶成茶</div>
        </div>
        <span className="rc-go">进入一叶成茶</span>
      </button>
    </div>
  );
}

export default function RealmScreen() {
  const startChapter = useAppStore((s) => s.startChapter);

  return (
    <section className="screen screen-scroll screen-realm active" data-screen="realm">
      <div className="statusbar" />
      <div className="realm-head">
        <div className="eyebrow">茶境 · TEA REALM</div>
        <h2>
          喝过的茶，会慢慢
          <br />
          长成你的<span className="em">世界。</span>
        </h2>
      </div>
      <RealmWorld />
      <RealmUnlockedCard onEnter={startChapter} />
      <div className="realm-locked">
        <div className="q">？ ？ ？</div>
        继续刷茶，解锁更多茶境
      </div>
    </section>
  );
}
