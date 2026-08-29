"use client";

import { Check, Grains, Leaf, Plant, Sparkle } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import { useWokPhysics } from "@/components/realm/useWokPhysics";

export const craftSteps = [
  { name: "杀青", hint: "推开青气，让鲜叶停在当下。", gesture: "向前推" },
  { name: "揉捻", hint: "让叶片彼此靠近，汤感从这里开始聚。", gesture: "往复揉" },
  { name: "搓团", hint: "收紧叶形，把香气与质感留住。", gesture: "画一个圆" },
  { name: "提毫", hint: "最后一次轻搓，白毫才慢慢显出来。", gesture: "轻轻搓" },
] as const;

export function RealmAtmosphere() {
  return <div className="realm-atmosphere" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>;
}

export function LiquorEntryVisual({ liquorUrl, rippleUrl, busy, skipAnimations, onAdvance }: {
  liquorUrl?: string;
  rippleUrl?: string;
  busy: boolean;
  skipAnimations: boolean;
  onAdvance: () => Promise<boolean>;
}) {
  const [tapped, setTapped] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const tap = () => {
    if (busy || tapped) return;
    setTapped(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void onAdvance().then(() => setTapped(false));
    }, skipAnimations ? 0 : 480);
  };

  return (
    <div className={`realm-liquor ${tapped ? "tapped" : ""}`}>
      {liquorUrl ? <img className="realm-liquor-img" src={liquorUrl} alt="生成的茶汤交互示意" /> : null}
      {rippleUrl ? <motion.img className="realm-liquor-img realm-liquor-ripple" src={rippleUrl} alt="" initial={false} animate={{ opacity: tapped ? 1 : 0 }} transition={{ duration: skipAnimations ? 0 : 0.4 }} /> : null}
      {!tapped ? <button className="realm-tap-pill" disabled={busy} onClick={tap}>轻触茶汤</button> : <span className="realm-liquor-status" role="status">雾正从杯中升起</span>}
    </div>
  );
}

export function MistMountainVisual({ mistUrl, score, direction, mode, busy, onMove, onKeyboard, onAdvance }: {
  mistUrl?: string;
  score: number;
  direction: 1 | -1;
  mode: "orientation" | "pointer" | "reducedMotion";
  busy: boolean;
  onMove: (distance: number, direction: 1 | -1) => void;
  onKeyboard: () => void;
  onAdvance: () => Promise<boolean>;
}) {
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const clearRatio = Math.min(1, score / 100);
  const edge = (1 - clearRatio) * 100;
  const mask = `linear-gradient(${direction > 0 ? "to left" : "to right"}, black ${Math.max(0, edge - 20)}%, transparent ${Math.min(100, edge + 6)}%)`;
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointerRef.current;
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    onMove(Math.abs(dx) + Math.abs(dy), Math.abs(dx) > 2 ? (dx > 0 ? 1 : -1) : direction);
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ") onKeyboard();
  };

  return (
    <div className="realm-mist-full" role="group" tabIndex={0} aria-label="拨开雾层"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        pointerRef.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={pointerMove}
      onPointerUp={() => { pointerRef.current = null; }}
      onPointerCancel={() => { pointerRef.current = null; }}
      onKeyDown={keyboard}>
      {mistUrl ? <motion.img className="realm-mist" src={mistUrl} alt="可拨开的生成雾层" style={{ WebkitMaskImage: mask, maskImage: mask }} animate={{ x: direction * score * 1.6, opacity: Math.max(0.05, 1 - score / 90) }} /> : null}
      <div className="realm-drift" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className="realm-mist-ui">
        <div className="realm-meter"><span style={{ width: `${score}%` }} /></div>
        <small>{score >= 70 ? "雾散了，山出来了。" : mode === "orientation" ? "轻轻倾斜手机" : "左右拖动拨开雾"}</small>
        {score >= 70 ? <button className="button primary" disabled={busy} onClick={() => void onAdvance()}>山出现了</button> : null}
      </div>
    </div>
  );
}

const budOptions = [
  { id: "single", role: "bud_single", label: "只有一枚芽" },
  { id: "bud-leaf", role: "bud_leaf", label: "一芽一叶" },
  { id: "open", role: "bud_open", label: "两片已展开的叶" },
  { id: "stem", role: "bud_stem", label: "带长梗的叶" },
] as const;

export function BudPickerVisual({ assetUrls, chosen, feedback, busy, onChoose, onAdvance }: {
  assetUrls: Map<string, string>;
  chosen: boolean;
  feedback: string;
  busy: boolean;
  onChoose: (id: string) => void;
  onAdvance: () => Promise<boolean>;
}) {
  const [shaking, setShaking] = useState<string | null>(null);
  const choose = (id: string) => {
    if (id !== "bud-leaf") {
      setShaking(id);
      window.setTimeout(() => setShaking((current) => current === id ? null : current), 420);
    }
    onChoose(id);
  };
  return (
    <div className="realm-buds" aria-label="选择一芽一叶">
      {budOptions.map(({ id, role, label }) => {
        const selected = chosen && id === "bud-leaf";
        const assetUrl = assetUrls.get(role);
        return <button key={id} aria-pressed={selected} className={`realm-bud ${selected ? "chosen" : ""} ${shaking === id ? "shake" : ""}`} onClick={() => choose(id)}>
          {assetUrl ? <img className="realm-bud-img" src={assetUrl} alt="" /> : <Leaf className="realm-bud-fallback" size={48} weight="duotone" aria-hidden="true" />}
          <span className="realm-bud-label">{label}</span>
        </button>;
      })}
      <p className="realm-feedback" aria-live="polite">{chosen ? "1 / 53,000+ · 这一片叶子很轻，人的劳动很重。" : feedback}</p>
      {chosen ? <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={() => void onAdvance()}>把它带去锅边</motion.button> : null}
    </div>
  );
}

const leafSizes = [22, 28, 18, 26, 24];

export function WokCraftVisual({ craftIndex, animated, busy, onDistance, onKeyboardStep, onAdvance }: {
  craftIndex: number;
  animated: boolean;
  busy: boolean;
  onDistance: (distance: number) => void;
  onKeyboardStep: () => void;
  onAdvance: () => Promise<boolean>;
}) {
  const { wokRef, leafElementsRef, onPointerDown, onPointerMove, onPointerUp } = useWokPhysics({ active: animated, onDistance });
  return (
    <div className="realm-craft">
      <div className="realm-wok" ref={wokRef} data-craft={craftIndex} data-physics-active={animated ? "true" : "false"} role="button" tabIndex={0} aria-label="制茶手势区域"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onKeyboardStep(); }}>
        <div className="realm-steam" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="realm-tea-leaves" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => <span key={index} className="realm-leaf-particle" ref={(element) => { leafElementsRef.current[index] = element; }}><Leaf size={leafSizes[index % leafSizes.length]} weight="duotone" /></span>)}
        </div>
        {craftIndex < craftSteps.length ? <strong>{craftSteps[craftIndex].gesture}</strong> : <strong>四手已经做完</strong>}
      </div>
      <div className="realm-craft-progress" aria-label={`制茶进度 ${craftIndex} / ${craftSteps.length}`}><span style={{ width: `${craftIndex / craftSteps.length * 100}%` }} /></div>
      <div className="realm-craft-list">
        {craftSteps.map((step, index) => <div className={index < craftIndex ? "done" : index === craftIndex ? "active" : ""} key={step.name}><span>{index < craftIndex ? <Check size={12} weight="bold" /> : index + 1}</span><p><strong>{index < craftIndex ? step.name : index === craftIndex ? step.gesture : "···"}</strong>{index < craftIndex ? <small>{step.hint}</small> : null}</p></div>)}
      </div>
      {craftIndex >= craftSteps.length ? <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={() => void onAdvance()}>去做最后的判断</motion.button> : null}
    </div>
  );
}

export function HumanJudgmentVisual({ maturity, onTry, onStop }: { maturity: number; onTry: () => void; onStop: () => void }) {
  const percentage = Math.min(100, maturity * 28);
  const red = Math.round(93 + percentage * 0.72);
  const green = Math.round(127 - percentage * 0.88);
  const blue = Math.round(79 - percentage * 0.72);
  return (
    <div className="realm-judgment" role="group" aria-label="判断何时停手">
      <motion.div className="realm-leaf-mass" style={{ background: `radial-gradient(circle, rgba(${red},${green},${blue},.58), rgba(28,48,30,.14) 62%, transparent 64%)` }} animate={{ rotate: maturity * 7, scale: 1 + maturity * .025 }}><Grains size={80} weight="duotone" /></motion.div>
      <div className="realm-meter"><span style={{ width: `${percentage}%` }} /></div>
      <p>{maturity < 3 ? "再摸一次叶片的状态，停手的时刻由你来定。" : "青气渐退，叶子收紧。手感会告诉你什么时候停。"}</p>
      <button className="button" onClick={onTry}>再试一手</button>
      <button className="button primary" onClick={onStop}>现在停</button>
    </div>
  );
}

export function RealTeaRevealVisual({ dryTeaUrl, revealed, userWords, busy, onReveal, onAdvance }: {
  dryTeaUrl?: string;
  revealed: boolean;
  userWords?: string | null;
  busy: boolean;
  onReveal: () => void;
  onAdvance: () => Promise<boolean>;
}) {
  return (
    <div className="realm-real-reveal">
      <div className={`realm-real-frame ${revealed ? "revealed" : ""}`}>
        <div className="realm-stylized-leaves"><Sparkle size={24} /><Plant size={68} weight="duotone" /><Leaf size={48} weight="duotone" /></div>
        {dryTeaUrl ? <img src={dryTeaUrl} alt="论文 Figure 7A 中的都匀毛尖五级干茶对照" /> : null}
        {revealed ? <span className="realm-real-sweep" aria-hidden="true" /> : null}
      </div>
      <p>{userWords ? `你说“${userWords}”。这一口的路，从雾里的一芽开始。` : "杯里轻盈的鲜，来自嫩叶、火候，也来自人在关键时刻的判断。"}</p>
      <small className="realm-credit">实物参考：Xia et al. (2026), Food Chemistry: X, Fig. 7A, CC BY 4.0。论文样本与商品批次无关。</small>
      {!revealed ? <button className="button primary" onClick={onReveal}>回到真实干茶</button> : <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={() => void onAdvance()}>收下这一芽</motion.button>}
    </div>
  );
}

export function SpecimenCollectVisual({ specimenUrl, skipAnimations, busy, onCollect }: {
  specimenUrl?: string;
  skipAnimations: boolean;
  busy: boolean;
  onCollect: () => void;
}) {
  return (
    <div className="realm-collect">
      {specimenUrl ? <div className="realm-specimen-wrap"><motion.img src={specimenUrl} alt="白毫数字标本" animate={{ y: [0, -8, 0] }} transition={{ duration: skipAnimations ? 0 : 2.5, repeat: Infinity }} /><span className="realm-specimen-shine" aria-hidden="true" /></div> : null}
      <p>收下白毫，茶护照多一枚标本，黔南也会亮起来。</p>
      <button className="button primary block" disabled={busy} onClick={onCollect}>{busy ? "正在收藏…" : "收进茶护照"}</button>
    </div>
  );
}
