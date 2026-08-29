'use client';

// ============================================================
// Screen 14 · Tea-BTI（喝出来的味觉人格）
// 逐字复刻 index.html Screen 14 与 renderBtiAxes。
// ============================================================
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';

interface BtiAxisData {
  l: string;
  r: string;
  val: number;
  note: string;
}

/** 四轴数据（与 index.html renderBtiAxes 一致） */
const AXES: BtiAxisData[] = [
  { l: '轻盈', r: '饱满', val: 24, note: '偏轻盈' },
  { l: '清鲜', r: '温熟', val: 18, note: '偏清鲜' },
  { l: '甜润', r: '劲爽', val: 32, note: '略偏甜润' },
  { l: '干净', r: '绵长', val: 71, note: '偏绵长' },
];

// 与 globals.css .axis .fill/.knob 一致的缓动曲线
const EASE: [number, number, number, number] = [0.22, 0.9, 0.3, 1];

/** 单条四轴（.axis），用 framer-motion 做填充/旋钮入场过渡 */
export function BtiAxis({ axis, index = 0 }: { axis: BtiAxisData; index?: number }) {
  const leftSide = axis.val < 50;

  return (
    <div className="axis">
      <div className="ax-labels">
        <span className={leftSide ? 'a-on' : ''}>{axis.l}</span>
        <span className={!leftSide ? 'a-on' : ''}>{axis.r}</span>
      </div>
      <div className="ax-bar">
        <motion.div
          className="fill"
          style={{ transition: 'none' }}
          initial={{ width: '0%' }}
          animate={{ width: `${axis.val}%` }}
          transition={{ duration: 0.9, ease: EASE, delay: index * 0.08 }}
        />
        <motion.div
          className="knob"
          style={{ transition: 'none' }}
          initial={{ left: '0%' }}
          animate={{ left: `${axis.val}%` }}
          transition={{ duration: 0.9, ease: EASE, delay: index * 0.08 }}
        />
      </div>
      <div className="ax-note">{axis.note}</div>
    </div>
  );
}

/** 四轴可视化容器 */
export function BtiAxes() {
  return (
    <div className="bti-axes">
      {AXES.map((axis, i) => (
        <BtiAxis key={axis.l} axis={axis} index={i} />
      ))}
    </div>
  );
}

/** persona 卡（.bti-persona） */
export function BtiPersona() {
  return (
    <div className="bti-persona">
      <span className="p-emoji">🌫</span>
      <div className="p-name">春雾回甘型</div>
      <div className="p-desc">
        你更容易被轻盈、清鲜的茶吸引。
        <br />
        喜欢入口柔和一点，
        <br />
        但尾巴最好留久一点。
      </div>
    </div>
  );
}

/** 证据区（.bti-evidence） */
export function BtiEvidence() {
  return (
    <div className="bti-evidence">
      <div className="e-title">最近让这个画像更清晰的是：</div>
      <div className="e-row">
        <span className="e-ico">❤️</span>都匀毛尖
      </div>
      <div className="e-row">
        <span className="e-ico">❤️</span>湄潭翠芽
      </div>
      <div className="e-row">
        <span className="e-ico">→</span>
        <span className="skip-tag">跳过某款浓厚型茶</span>
      </div>
    </div>
  );
}

export default function TeaBtiScreen() {
  const go = useAppStore((s) => s.go);
  const toast = useAppStore((s) => s.toast);

  return (
    <section className="screen screen-scroll screen-teabti active">
      <div className="statusbar"></div>

      <div className="bti-head">
        <div className="eyebrow">IDENTITY · 喝出来的味觉人格</div>
        <h2>你的 Tea-BTI</h2>
        <div className="bti-state">正在形成</div>
      </div>

      <BtiPersona />
      <BtiAxes />

      <div className="bti-motto">
        <div className="m">不是测出来的，是喝出来的。</div>
      </div>

      <BtiEvidence />

      <div className="bti-actions">
        <button className="btn btn-primary" onClick={() => go('swipe')}>
          继续刷，让它更懂你
        </button>
        <button className="btn btn-ghost" onClick={() => toast('分享卡片已准备好')}>
          分享我的 Tea-BTI
        </button>
      </div>
    </section>
  );
}
