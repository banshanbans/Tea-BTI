'use client';

// ============================================================
// 桌面端左右侧栏（≥1000px 显示，.side-left 品牌 / .side-right 状态卡）
// 布局：左栏 + {children}(手机 #app) + 右栏，与 index.html 的 .stage 结构一致。
// ============================================================
import type { ReactNode } from 'react';
import { useAppStore } from '@/stores/app-store';

// Tea-BTI 四轴（与 index.html 的 sideAxesHTML 数据一致）
const SIDE_AXES = [
  { l: '轻盈', r: '饱满', val: 24 },
  { l: '清鲜', r: '温熟', val: 18 },
  { l: '甜润', r: '劲爽', val: 32 },
  { l: '干净', r: '绵长', val: 71 },
];

function Mark() {
  return (
    <div className="mark">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3c3 2.5 6 3 6 6 0 2-1 3.5-3 4.5 2 1 3 2.5 3 4.5 0 3-3 3-6 3s-6 0-6-3c0-2 1-3.5 3-4.5C7 12.5 6 11 6 9c0-3 3-3.5 6-6Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

export default function DesktopSidebar({ children }: { children?: ReactNode }) {
  const passportCount = useAppStore((s) => s.passport.length);

  return (
    <>
      <aside className="side side-left">
        <div className="side-logo">
          <Mark />
          <div className="word">
            刷茶
            <small>SHUACHA</small>
          </div>
        </div>
        <p className="side-slogan">
          你不用先懂茶。
          <br />
          刷几下，茶先开始懂你。
        </p>
        <p className="side-desc">
          一个年轻人第一次进入原叶茶世界的发现界面。不用先学术语，先凭感觉，找到第一杯真正想喝的原叶茶。
        </p>
        <div className="side-loop">
          <span>Discover</span>
          <i>→</i>
          <span>Brew</span>
          <i>→</i>
          <span>Taste</span>
          <i>→</i>
          <span>Explore</span>
          <i>→</i>
          <span>Remember</span>
          <i>→</i>
          <span>Evolve</span>
        </div>
        <div className="side-tabs">
          <div className="st-item">
            <b>刷茶</b>
            <span>盲刷发现，先感觉后认识</span>
          </div>
          <div className="st-item">
            <b>茶境</b>
            <span>2.5D 像素，走进茶山</span>
          </div>
          <div className="st-item">
            <b>我的</b>
            <span>茶护照 · Tea-BTI</span>
          </div>
        </div>
        <div className="side-hint">
          <span className="dot"></span>不需要做测试
        </div>
      </aside>

      {children}

      <aside className="side side-right">
        <div className="side-card">
          <div className="sc-label">
            TEA-BTI · <span className="sc-state">正在形成</span>
          </div>
          <div className="sc-persona">🌫 春雾回甘型</div>
          <div className="sc-desc">你更容易被轻盈、清鲜的茶吸引。</div>
          <div className="sc-axes">
            {SIDE_AXES.map((a) => {
              const left = a.val < 50;
              return (
                <div className="sc-axis" key={a.l}>
                  <div className="ax-labels">
                    <span className={left ? 'on' : ''}>{a.l}</span>
                    <span className={!left ? 'on' : ''}>{a.r}</span>
                  </div>
                  <div className="bar">
                    <div className="fill" style={{ width: `${a.val}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="side-card">
          <div className="sc-label">已解锁茶境</div>
          <div className="sc-realm">🍃 都匀毛尖</div>
          <div className="sc-sub">贵州 · 黔南 · 一叶成茶</div>
        </div>
        <div className="side-card">
          <div className="sc-label">茶护照</div>
          <div className="sc-count">{passportCount} 杯</div>
          <div className="sc-sub">你真正喝过的茶，才算来过这里。</div>
        </div>
      </aside>
    </>
  );
}
