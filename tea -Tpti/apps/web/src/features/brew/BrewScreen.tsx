'use client';

// ============================================================
// Screen 7 · Brew Mode（泡茶陪伴）
// 深色沉浸页：摄像头预览 mock（盖碗）+ 五步进度 + AI 茶伴 + 底部操作。
// 文案逐字迁移自 index.html 的 renderBrew（steps / says / whys / stateTxt）。
// 状态与动作全部走 useAppStore，不在组件内自建重复状态。
// ============================================================
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useAppStore,
  BREW_STEPS,
  BREW_STATE_TEXTS,
  BREW_SAYS,
  BREW_WHYS,
} from '@/stores/app-store';
import { TEAS } from '@/lib/teas';

// ----------------------------------------------------------------------------
// 子组件（命名导出，便于 Integrate 与复用）
// ----------------------------------------------------------------------------

interface BrewHeaderProps {
  teaName: string;
  onBack: () => void;
}

/** 顶部：返回 + 当前茶名「泡茶陪伴」+ 麦克风图标 */
export function BrewHeader({ teaName, onBack }: BrewHeaderProps) {
  return (
    <div className="brew-head">
      <button className="back" onClick={onBack}>
        ←
      </button>
      <div className="btitle">
        {teaName}
        <small>泡茶陪伴</small>
      </div>
      <div className="brew-mic">🎙</div>
    </div>
  );
}

interface BrewCameraProps {
  stateText: string;
  gaiwan: string;
}

/** 摄像头预览 mock：检测到盖碗 + 当前步骤状态标签 */
export function BrewCamera({ stateText, gaiwan }: BrewCameraProps) {
  return (
    <div className="brew-cam">
      <div className="cam-vignette"></div>
      <div className="cam-tag tl">
        <span className="led"></span>检测到：盖碗
      </div>
      <div className="cam-teaware">
        <span className="gaiwan">{gaiwan}</span>
      </div>
      <div className="cam-tag br">
        <span className="led"></span>
        <span>{stateText}</span>
      </div>
    </div>
  );
}

interface BrewStepsProps {
  step: number;
}

/** 步骤进度条：投茶 → 注水 → 等待 → 出汤 → 完成（高亮当前） */
export function BrewSteps({ step }: BrewStepsProps) {
  return (
    <div className="brew-steps">
      {BREW_STEPS.map((label, i) => {
        let cls = '';
        if (i < step) cls = 'done';
        else if (i === step) cls = 'now';
        const dot = i < step ? '✓' : i === step ? '•' : i + 1;
        return (
          <div className={`step ${cls}`} key={label}>
            <div className="dot">{dot}</div>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface BrewCompanionProps {
  say: string;
  why: string;
}

/** AI 茶伴卡片：当前话术 + 可展开的「为什么？」 */
export function BrewCompanion({ say, why }: BrewCompanionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="brew-companion">
      <div className="companion-says">
        <div className="av">🍃</div>
        <div>
          <div className="say">{say}</div>
          <button className="why" onClick={() => setOpen((v) => !v)}>
            为什么？
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(237,242,233,.7)' }}>
                  {why}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface BrewFooterProps {
  onNext: () => void;
}

/** 底部：结束这一泡 / 下一步（均走 brewNext） */
export function BrewFooter({ onNext }: BrewFooterProps) {
  return (
    <div className="brew-foot">
      <button className="btn btn-dark-ghost" onClick={onNext}>
        结束这一泡
      </button>
      <button className="btn btn-primary" onClick={onNext}>
        下一步 ›
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 主 Screen
// ----------------------------------------------------------------------------

export default function BrewScreen() {
  const currentTea = useAppStore((s) => s.currentTea);
  const brewStep = useAppStore((s) => s.brewStep);
  const brewNext = useAppStore((s) => s.brewNext);
  const go = useAppStore((s) => s.go);

  const tea = TEAS[currentTea] ?? TEAS.duyun;

  return (
    <section className="screen screen-brew active" data-screen="brew">
      <BrewHeader teaName={tea.name} onBack={() => go('detail')} />
      <BrewCamera
        stateText={BREW_STATE_TEXTS[brewStep]}
        gaiwan={brewStep === 3 ? '🍵' : '🫖'}
      />
      <BrewSteps step={brewStep} />
      <BrewCompanion say={BREW_SAYS[brewStep]} why={BREW_WHYS[brewStep]} />
      <BrewFooter onNext={brewNext} />
    </section>
  );
}
