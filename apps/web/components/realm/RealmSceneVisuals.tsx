"use client";

import { Check, Grains, Leaf, Plant, Sparkle } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";

import { useCraftController } from "@/components/realm/useCraftController";
import { useSteamBlow } from "@/components/realm/useSteamBlow";
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
        event.currentTarget.setPointerCapture?.(event.pointerId);
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
  { id: "bud-single", role: "bud_single", label: "只有一枚芽" },
  { id: "bud-leaf", role: "bud_leaf", label: "一芽一叶" },
  { id: "bud-open", role: "bud_open", label: "两片已展开的叶" },
  { id: "bud-stem", role: "bud_stem", label: "带长梗的叶" },
] as const;

export function isBudLift(startY: number, endY: number, durationMs: number, reducedMotion = false) {
  return reducedMotion || (durationMs >= 180 && startY - endY >= 64);
}

export function BudPickerVisual({ assetUrls, observerUrl, teacherUrl, chosen, feedback, teacherMessage, busy, reducedMotion, onChoose, onAdvance }: {
  assetUrls: Map<string, string>;
  observerUrl?: string;
  teacherUrl?: string;
  chosen: boolean;
  feedback: string;
  teacherMessage: string;
  busy: boolean;
  reducedMotion: boolean;
  onChoose: (id: string, inputMode: "pointer" | "keyboard" | "reducedMotion") => void;
  onAdvance: () => Promise<boolean>;
}) {
  const [shaking, setShaking] = useState<string | null>(null);
  const [lifting, setLifting] = useState<{ id: string; offset: number } | null>(null);
  const holdRef = useRef<{ id: string; pointerId: number; y: number; startedAt: number } | null>(null);
  const resetLift = () => {
    holdRef.current = null;
    setLifting(null);
  };
  const choose = (id: string, inputMode: "pointer" | "keyboard" | "reducedMotion") => {
    if (id !== "bud-leaf") {
      setShaking(id);
      window.setTimeout(() => setShaking((current) => current === id ? null : current), 420);
    }
    onChoose(id, inputMode);
  };
  return (
    <div className="realm-buds" aria-label="按住并上提一芽一叶">
      {!teacherMessage && !chosen && observerUrl ? <img className="realm-teacher-observer" src={observerUrl} alt="茶师傅正在观察芽叶" /> : null}
      {budOptions.map(({ id, role, label }) => {
        const selected = chosen && id === "bud-leaf";
        const assetUrl = assetUrls.get(role);
        const liftOffset = lifting?.id === id ? lifting.offset : 0;
        return <button key={id} aria-pressed={selected} className={`realm-bud ${selected ? "chosen lifted" : ""} ${shaking === id ? "shake" : ""} ${lifting?.id === id ? "dragging" : ""}`}
          style={liftOffset ? { transform: `translateY(${liftOffset}px)` } : undefined}
          onPointerDown={(event) => {
            if (busy || chosen || (event.pointerType === "mouse" && event.button !== 0)) return;
            event.preventDefault();
            holdRef.current = { id, pointerId: event.pointerId, y: event.clientY, startedAt: performance.now() };
            setLifting({ id, offset: 0 });
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            const hold = holdRef.current;
            if (!hold || hold.id !== id || hold.pointerId !== event.pointerId) return;
            event.preventDefault();
            setLifting({ id, offset: Math.max(-96, Math.min(0, event.clientY - hold.y)) });
          }}
          onPointerUp={(event) => {
            const hold = holdRef.current;
            resetLift();
            if (!hold || hold.id !== id || hold.pointerId !== event.pointerId) return;
            const valid = isBudLift(hold.y, event.clientY, performance.now() - hold.startedAt, reducedMotion);
            if (valid) choose(id, reducedMotion ? "reducedMotion" : "pointer");
          }}
          onPointerCancel={resetLift}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(id, reducedMotion ? "reducedMotion" : "keyboard"); } }}
          onClick={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}>
          {assetUrl ? <img className="realm-bud-img" src={assetUrl} alt="" /> : <Leaf className="realm-bud-fallback" size={48} weight="duotone" aria-hidden="true" />}
          <span className="realm-bud-label">{label}</span>
        </button>;
      })}
      <p className="realm-bud-guide">{reducedMotion ? "选择“一芽一叶”即可完成" : "按住至少片刻，再向上提起"}</p>
      {teacherMessage ? <motion.aside className="realm-teacher" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        {teacherUrl ? <img src={teacherUrl} alt="茶师傅温和伸手提醒采芽" /> : null}
        <p><strong>茶师傅</strong>{teacherMessage}</p>
      </motion.aside> : null}
      <p className="realm-feedback" aria-live="polite">{chosen ? "1 / 53,000+ · 这一片叶子很轻，人的劳动很重。" : feedback}</p>
      {chosen ? <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={() => void onAdvance()}>把它带去锅边</motion.button> : null}
    </div>
  );
}

const leafSizes = [22, 28, 18, 26, 24];

export function WokCraftVisual({ animated, busy, mode, gamma, tiltRef, onFallback, onTone, onAdvance }: {
  animated: boolean;
  busy: boolean;
  mode: "orientation" | "pointer" | "reducedMotion";
  gamma: number;
  tiltRef: MutableRefObject<{ x: number; y: number }>;
  onFallback: (reason: string) => void;
  onTone: (index: number) => void;
  onAdvance: (result: Record<string, unknown>) => Promise<boolean>;
}) {
  const steam = useSteamBlow({ active: true, reducedMotion: mode === "reducedMotion", onFallback });
  const craft = useCraftController({
    orientationActive: mode === "orientation" && steam.state === "cleared",
    gamma, reducedMotion: mode === "reducedMotion", onCompleteTone: onTone,
    onMultitouchFallback: () => onFallback("multitouch_unsupported"),
  });
  const physics = useWokPhysics({ active: animated, tiltRef });
  const wipeRef = useRef<{ x: number; distance: number } | null>(null);
  const craftIndex = craft.index;
  const craftDone = craftIndex >= craftSteps.length;
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => { physics.onPointerDown(event); craft.pointerDown(event); };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => { physics.onPointerMove(event); craft.pointerMove(event); };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => { physics.onPointerUp(); craft.pointerUp(event); };
  const finish = () => void onAdvance({ kind: "wok-craft", steamMode: steam.mode, gestures: craft.results });
  return (
    <div className="realm-craft">
      <div className="realm-wok" ref={physics.wokRef} data-craft={craftIndex} data-physics-active={animated ? "true" : "false"} role="button" tabIndex={0} aria-label="制茶手势区域"
        onPointerDown={steam.state === "cleared" ? pointerDown : undefined} onPointerMove={steam.state === "cleared" ? pointerMove : undefined}
        onPointerUp={steam.state === "cleared" ? pointerUp : undefined} onPointerCancel={steam.state === "cleared" ? pointerUp : undefined}
        onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && steam.state === "cleared") craft.keyboard(); }}>
        {steam.state !== "cleared" ? <div className="realm-steam" aria-hidden="true"><i /><i /><i /><i /><i /></div> : null}
        <div className="realm-tea-leaves" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => <span key={index} className="realm-leaf-particle" ref={(element) => { physics.leafElementsRef.current[index] = element; }}><Leaf size={leafSizes[index % leafSizes.length]} weight="duotone" /></span>)}
        </div>
        {steam.state === "cleared" ? <strong>{craftDone ? "四手已经做完" : craftSteps[craftIndex].gesture}</strong> : <strong>{steam.state === "listening" ? "对着手机轻轻吹气" : "先把蒸汽散开"}</strong>}
      </div>
      {steam.state === "idle" ? <div className="realm-steam-actions"><button className="button primary" onClick={() => void steam.start()}>吹开蒸汽</button><button className="button" onClick={steam.chooseWipe}>改用手指擦开</button><small>只在本机检测音量变化，不录音、不上传。</small></div> : null}
      {steam.state === "listening" ? <p className="realm-feedback" role="status">正在听风声，8 秒后会自动提供触控方式…</p> : null}
      {steam.state === "fallback" ? <div className="realm-steam-wipe" tabIndex={0} role="button" aria-label="左右擦开蒸汽"
        onPointerDown={(event) => { wipeRef.current = { x: event.clientX, distance: 0 }; event.currentTarget.setPointerCapture?.(event.pointerId); }}
        onPointerMove={(event) => { const wipe = wipeRef.current; if (!wipe) return; wipe.distance += Math.abs(event.clientX - wipe.x); wipe.x = event.clientX; if (wipe.distance >= 90) { wipeRef.current = null; steam.wipe(); } }}
        onPointerUp={() => { wipeRef.current = null; }} onPointerCancel={() => { wipeRef.current = null; }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") steam.keyboard(); }}>左右擦动，把蒸汽拨开</div> : null}
      <div className="realm-craft-progress" aria-label={`制茶进度 ${craftIndex} / ${craftSteps.length}`}><span style={{ width: `${craftIndex / craftSteps.length * 100}%` }} /></div>
      <div className="realm-craft-list">
        {craftSteps.map((step, index) => <div className={index < craftIndex ? "done" : index === craftIndex ? "active" : ""} key={step.name}><span>{index < craftIndex ? <Check size={12} weight="bold" /> : index + 1}</span><p><strong>{index < craftIndex ? step.name : index === craftIndex ? step.gesture : "···"}</strong>{index < craftIndex ? <small>{step.hint}</small> : null}</p></div>)}
      </div>
      {!craftDone && craft.canAssist ? <button className="button" onClick={craft.assist}>使用简化动作完成</button> : null}
      {!craftDone && steam.state === "cleared" ? <p className="realm-feedback" aria-live="polite">{craft.attempts[craft.current!] ? `再试一次，已经尝试 ${craft.attempts[craft.current!]} 次。` : mode === "orientation" && craft.current === "killGreen" ? "左右倾斜手机，让鲜叶在锅里往返。" : craftSteps[craftIndex].hint}</p> : null}
      {craftDone ? <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={finish}>去做最后的判断</motion.button> : null}
    </div>
  );
}

export function HumanJudgmentVisual({ teacherUrl, maturity, onTry, onStop }: { teacherUrl?: string; maturity: number; onTry: () => void; onStop: (window: "early" | "balanced" | "late") => void }) {
  const percentage = Math.min(100, maturity * 20);
  const stopWindow = maturity <= 1 ? "early" : maturity <= 3 ? "balanced" : "late";
  const labels = { early: "偏早 · 叶色鲜绿，青气仍明显", balanced: "刚好 · 青气渐退，白毫显露", late: "偏晚 · 叶形收紧，火香增强" } as const;
  const red = Math.round(93 + percentage * 0.72);
  const green = Math.round(127 - percentage * 0.88);
  const blue = Math.round(79 - percentage * 0.72);
  return (
    <div className="realm-judgment" role="group" aria-label="判断何时停手">
      {teacherUrl ? <img className="realm-teacher-explain" src={teacherUrl} alt="茶师傅讲解起锅判断" /> : null}
      <motion.div className="realm-leaf-mass" style={{ background: `radial-gradient(circle, rgba(${red},${green},${blue},.58), rgba(28,48,30,.14) 62%, transparent 64%)` }} animate={{ rotate: maturity * 7, scale: 1 + maturity * .025 }}><Grains size={80} weight="duotone" /></motion.div>
      <div className="realm-meter"><span style={{ width: `${percentage}%` }} /></div>
      <p><strong>{labels[stopWindow]}</strong><br />没有唯一答案，停手的时刻由你来定。</p>
      <button className="button" disabled={maturity >= 5} onClick={onTry}>再试一手</button>
      <button className="button primary" onClick={() => onStop(stopWindow)}>现在停</button>
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
