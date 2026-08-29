'use client';

// ============================================================
// BlindCard —— 盲品卡片（先感觉、后术语）
// 复刻 index.html 的 cardHTML + artSVG 三种视觉风格 mist/leaf/amber
// ============================================================
import type { Tea } from '@/lib/types';

/** 卡片中心的 emoji（带投影） */
function CenterEmoji({ emoji }: { emoji: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        fontSize: 76,
        filter: 'drop-shadow(0 10px 18px rgba(31,61,43,.18))',
      }}
    >
      {emoji}
    </div>
  );
}

/** 抽象茶视觉（非商品图），对应 artSVG 三种风格 */
export function TeaArt({ kind, emoji }: { kind: string; emoji: string }) {
  if (kind === 'amber') {
    return (
      <div className="art" style={{ background: 'linear-gradient(160deg,#EAD7B0,#D9BE8C)' }}>
        <div
          className="blob"
          style={{
            width: 190,
            height: 190,
            left: -20,
            top: -20,
            background: 'linear-gradient(145deg,rgba(201,154,91,.5),rgba(201,154,91,.1))',
          }}
        />
        <div
          className="blob"
          style={{
            width: 150,
            height: 150,
            right: -10,
            bottom: -10,
            background: 'linear-gradient(145deg,rgba(168,123,63,.45),transparent)',
          }}
        />
        <CenterEmoji emoji={emoji} />
      </div>
    );
  }

  if (kind === 'leaf') {
    return (
      <div className="art" style={{ background: 'linear-gradient(160deg,#DCE8CF,#C3D8AC)' }}>
        <div
          className="blob"
          style={{
            width: 200,
            height: 200,
            right: -30,
            top: -30,
            background: 'linear-gradient(145deg,rgba(111,154,78,.4),transparent)',
          }}
        />
        <div
          className="blob"
          style={{
            width: 140,
            height: 140,
            left: -14,
            bottom: -14,
            background: 'linear-gradient(145deg,rgba(111,154,78,.32),transparent)',
          }}
        />
        <CenterEmoji emoji={emoji} />
      </div>
    );
  }

  // mist（默认）
  return (
    <div className="art" style={{ background: 'linear-gradient(170deg,#E8EFE0,#D7E4C9 60%,#C9D8B6)' }}>
      <svg
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <ellipse cx="120" cy="60" rx="120" ry="36" fill="rgba(255,255,255,.55)" />
        <ellipse cx="280" cy="90" rx="150" ry="42" fill="rgba(255,255,255,.45)" />
        <path
          d="M0 200 L80 150 L150 185 L230 140 L320 185 L400 150 L400 240 L0 240 Z"
          fill="rgba(111,154,78,.22)"
        />
        <path
          d="M0 220 L90 180 L180 210 L260 175 L340 210 L400 185 L400 240 L0 240 Z"
          fill="rgba(85,124,58,.28)"
        />
      </svg>
      <CenterEmoji emoji={emoji} />
    </div>
  );
}

export default function BlindCard({ tea }: { tea: Tea }) {
  const lines = tea.blind.desc.split('\n');

  return (
    <>
      <div className="card-art">
        <TeaArt kind={tea.blind.art} emoji={tea.emoji} />
        <div className="art-mist"></div>
      </div>
      <div className="card-body">
        <div className="card-headline">{tea.blind.headline}</div>
        <div className="card-desc">
          {lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </div>
        <div className="card-tags">
          {tea.blind.tags.map((x) => (
            <span key={x} className="tag">
              {x}
            </span>
          ))}
        </div>
        <div className="card-scene">{tea.blind.scene}</div>
      </div>
    </>
  );
}
