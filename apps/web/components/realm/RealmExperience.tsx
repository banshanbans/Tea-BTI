"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { Check, FastForward, Grains, Leaf, Plant, SpeakerHigh, SpeakerSlash, Sparkle, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { RealmComplete, RealmDetail, RealmMutation } from "@/lib/api";

type InteractionMode = "orientation" | "pointer" | "reducedMotion";
type FallbackReason = "permission_denied" | "unsupported" | "desktop" | "reduced_motion" | "sensor_error";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const craftSteps = [
  { name: "杀青", hint: "推开青气，让鲜叶停在当下。", gesture: "向前推" },
  { name: "揉捻", hint: "让叶片彼此靠近，汤感从这里开始聚。", gesture: "往复揉" },
  { name: "搓团", hint: "收紧叶形，把香气与质感留住。", gesture: "画一个圆" },
  { name: "提毫", hint: "最后一次轻搓，白毫才慢慢显出来。", gesture: "轻轻搓" },
] as const;

const BUD_IMAGES: Record<string, string> = {
  single: "/realm/bud-single.png",
  "bud-leaf": "/realm/bud-leaf.png",
  open: "/realm/bud-open.png",
  stem: "/realm/bud-stem.png",
};

const BUD_HINTS: Record<string, string> = {
  single: "只有一枚芽，还差那片陪在旁边的嫩叶。再找找“一芽一叶”。",
  open: "叶子已经展开了，错过了最嫩的时机。再找找“一芽一叶”。",
  stem: "这根梗太长了，采的时候要连着一点嫩叶。再找找“一芽一叶”。",
};

const copyVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};
const copyItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
const sceneVariants: Variants = {
  enter: { opacity: 0, y: 30, scale: 0.985 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } },
  exit: { opacity: 0, y: -20, scale: 0.995, transition: { duration: 0.28, ease: "easeIn" } },
};

const LEAF_COUNT = 14;
const LEAF_SIZES = [22, 28, 18, 26, 24];
const GRAVITY = 0.18;

type WokLeaf = {
  el: HTMLSpanElement | null;
  x: number; y: number; vx: number; vy: number;
  angle: number; av: number; r: number;
};


function eventId(prefix: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
}

function tone(enabled: boolean, frequency = 480) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.035, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
  oscillator.addEventListener("ended", () => void context.close());
}

export function RealmExperience({ realmId, replay }: { realmId: string; replay: boolean }) {
  const [detail, setDetail] = useState<RealmDetail | null>(null);
  const [screen, setScreen] = useState("");
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<InteractionMode>("pointer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [skipAnimations, setSkipAnimations] = useState(false);
  const [mistScore, setMistScore] = useState(0);
  const [wrongBud, setWrongBud] = useState("");
  const [shakeBud, setShakeBud] = useState<string | null>(null);
  const [budChosen, setBudChosen] = useState(false);
  const [craftIndex, setCraftIndex] = useState(0);
  const [craftDistance, setCraftDistance] = useState(0);
  const [maturity, setMaturity] = useState(0);
  const [heating, setHeating] = useState(false);
  const [realRevealed, setRealRevealed] = useState(false);
  const [liquorTapped, setLiquorTapped] = useState(false);
  const [completion, setCompletion] = useState<RealmComplete | null>(null);
  const sceneStartedRef = useRef(Date.now());
  const experienceStartedRef = useRef(Date.now());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const wokRef = useRef<HTMLDivElement>(null);
  const leafElsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const particlesRef = useRef<WokLeaf[]>([]);
  const dragRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, active: false });
  const mistDirRef = useRef(1); // 1 = 向右滑, -1 = 向左滑

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await authenticated<RealmDetail>(`/realms/${realmId}`);
      setDetail(response);
      const initial = replay ? response.definition.sceneOrder[0] : response.progress.currentScene;
      setScreen(initial);
      setMode(response.progress.interactionMode || "pointer");
      if (response.progress.status === "in_progress" || (response.progress.status === "completed" && !replay)) setStarted(true);
      void authenticated<RealmMutation>(`/realms/${realmId}/events`, {
        method: "POST",
        ...jsonBody({ clientEventId: eventId("realm-preview"), eventType: "realm_preview_opened" }),
      }).catch(() => undefined);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [realmId, replay]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    sceneStartedRef.current = Date.now();
    setNotice("");
    setLiquorTapped(false);
    if (screen === "mist-mountain") {
      setMistScore(0);
      mistDirRef.current = 1;
    }
    if (screen === "human-judgment") {
      setMaturity(0);
      setHeating(true);
    } else {
      setHeating(false);
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== "human-judgment" || !heating) return;
    const interval = setInterval(() => setMaturity((v) => Math.min(100, v + 0.9)), 80);
    return () => clearInterval(interval);
  }, [screen, heating]);

  useEffect(() => {
    if (screen === "human-judgment" && heating && maturity >= 100) {
      setHeating(false);
      tone(soundOn, 220);
    }
  }, [maturity, heating, screen]);

  useEffect(() => {
    if (!shakeBud) return;
    const timer = window.setTimeout(() => setShakeBud(null), 420);
    return () => window.clearTimeout(timer);
  }, [shakeBud]);

  useEffect(() => {
    if (mode !== "orientation" || screen !== "mist-mountain") return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma;
      if (typeof gamma === "number") { if (Math.abs(gamma) > 2) mistDirRef.current = gamma > 0 ? 1 : -1; setMistScore((value) => Math.min(100, value + Math.abs(gamma) / 6)); }
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [mode, screen]);

  useEffect(() => {
    if (screen === "mist-mountain" && mistScore >= 70) {
      void advance();
    }
  }, [mistScore, screen]);

  const assets = useMemo(() => new Map(detail?.definition.assets.map((asset) => [asset.role, asset]) || []), [detail]);
  const sceneIndex = detail ? detail.definition.sceneOrder.indexOf(screen) : 0;
  const scene = detail?.definition.scenes.find((item) => item.id === screen);
  const mountain = assets.get("mountain_background");
  const mist = assets.get("mist_overlay");
  const workshop = assets.get("workshop_background");
  const dryTea = assets.get("dry_tea_reveal");
  const specimen = assets.get("specimen_card");

  const background = useMemo(() => {
    if (["wok-craft", "human-judgment", "real-tea-reveal"].includes(screen)) return workshop;
    if (["liquor-entry", "passport-specimen"].includes(screen)) return mist;
    return mountain;
  }, [screen, mist, mountain, workshop]);
  const mistClear = Math.min(1, mistScore / 100);
  const edge = (1 - mistClear) * 100;
  const mistDirSign = mistDirRef.current >= 0 ? 1 : -1;
  const mistMask = `linear-gradient(${mistDirSign >= 0 ? "to left" : "to right"}, black ${Math.max(0, edge - 20)}%, transparent ${Math.min(100, edge + 6)}%)`;

  async function chooseMode(): Promise<{ interactionMode: InteractionMode; fallbackReason?: FallbackReason }> {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return { interactionMode: "reducedMotion", fallbackReason: "reduced_motion" };
    const touchDevice = navigator.maxTouchPoints > 0;
    if (!("DeviceOrientationEvent" in window) || !touchDevice) {
      return { interactionMode: "pointer", fallbackReason: touchDevice ? "unsupported" : "desktop" };
    }
    try {
      const Orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
      if (Orientation.requestPermission) {
        const permission = await Orientation.requestPermission();
        if (permission !== "granted") return { interactionMode: "pointer", fallbackReason: "permission_denied" };
      }
      return { interactionMode: "orientation" };
    } catch {
      return { interactionMode: "pointer", fallbackReason: "sensor_error" };
    }
  }

  async function enter() {
    if (!detail || busy) return;
    setBusy(true); setError("");
    try {
      const selected = await chooseMode();
      const response = await authenticated<RealmMutation>(`/realms/${realmId}/start`, {
        method: "POST",
        ...jsonBody({ clientEventId: eventId("realm-start"), interactionMode: selected.interactionMode, fallbackReason: selected.fallbackReason, replay }),
      });
      setMode(selected.interactionMode);
      setDetail({ ...detail, progress: response.progress });
      setScreen(replay ? detail.definition.sceneOrder[0] : response.progress.currentScene);
      setStarted(true);
      experienceStartedRef.current = Date.now();
      tone(soundOn);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  function tapLiquor() {
    if (busy || liquorTapped) return;
    setLiquorTapped(true);
    tone(soundOn, 520);
    window.setTimeout(() => void advance(), 480);
  }

  async function advance() {
    if (!detail || !scene || busy) return;
    const next = detail.definition.sceneOrder[sceneIndex + 1];
    if (!next) return;
    setBusy(true); setError("");
    try {
      const response = await authenticated<RealmMutation>(`/realms/${realmId}/progress`, {
        method: "PATCH",
        ...jsonBody({ clientEventId: eventId(`realm-scene-${scene.id}`), completedScene: scene.id, elapsedMs: Date.now() - sceneStartedRef.current }),
      });
      setDetail({ ...detail, progress: response.progress });
      setScreen(replay ? next : response.progress.currentScene);
      tone(soundOn, 560 + sceneIndex * 30);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  async function revealRealTea() {
    setRealRevealed(true);
    tone(soundOn, 620);
    void authenticated<RealmMutation>(`/realms/${realmId}/events`, {
      method: "POST",
      ...jsonBody({ clientEventId: eventId("realm-real-reveal"), eventType: "realm_real_asset_revealed", sceneId: "real-tea-reveal", elapsedMs: Date.now() - sceneStartedRef.current, interactionMode: mode }),
    }).catch(() => undefined);
  }

  async function collect() {
    if (!detail || busy) return;
    setBusy(true); setError("");
    try {
      const response = await authenticated<RealmComplete>(`/realms/${realmId}/complete`, {
        method: "POST",
        ...jsonBody({ clientEventId: eventId("realm-complete"), totalElapsedMs: Date.now() - experienceStartedRef.current, interactionMode: mode }),
      });
      setCompletion(response);
      setDetail({ ...detail, progress: response.progress });
      tone(soundOn, 720);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  function handleMistPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerRef.current) return;
    const dx = event.clientX - pointerRef.current.x;
    const dy = event.clientY - pointerRef.current.y;
    const distance = Math.abs(dx) + Math.abs(dy);
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (Math.abs(dx) > 2) mistDirRef.current = dx > 0 ? 1 : -1;
    setMistScore((value) => Math.min(100, value + distance / 3));
  }

  function onWokPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    const wok = wokRef.current;
    if (wok) {
      const rect = wok.getBoundingClientRect();
      dragRef.current.x = event.clientX - rect.left;
      dragRef.current.y = event.clientY - rect.top;
      dragRef.current.vx = 0;
      dragRef.current.vy = 0;
      dragRef.current.active = true;
    }
  }

  function onWokPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerRef.current) return;
    const distance = Math.hypot(event.clientX - pointerRef.current.x, event.clientY - pointerRef.current.y);
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (craftIndex < craftSteps.length) {
      const next = craftDistance + distance;
      if (next >= 105) {
        setCraftIndex((value) => Math.min(craftSteps.length, value + 1));
        setCraftDistance(0);
        tone(soundOn, 430 + craftIndex * 50);
      } else {
        setCraftDistance(next);
      }
    }
    const wok = wokRef.current;
    if (wok) {
      const rect = wok.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      dragRef.current.vx = x - dragRef.current.x;
      dragRef.current.vy = y - dragRef.current.y;
      dragRef.current.x = x;
      dragRef.current.y = y;
      dragRef.current.active = true;
    }
  }

  function onWokPointerUp() {
    pointerRef.current = null;
    dragRef.current.active = false;
    dragRef.current.vx = 0;
    dragRef.current.vy = 0;
  }

  function stopHeating() {
    if (!heating) return;
    setHeating(false);
    tone(soundOn, 560);
    if (maturity >= 70) {
      void advance();
    }
  }

  function retryHeat() {
    setMaturity(0);
    setHeating(true);
    setNotice("");
    tone(soundOn, 430);
  }

  function stepWokPhysics(wok: HTMLDivElement) {
    const rect = wok.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const cx = w / 2, cy = h / 2;
    const rx = Math.max(10, w / 2 - 10), ry = Math.max(10, h / 2 - 10);
    const drag = dragRef.current;
    const leaves = particlesRef.current;

    for (const leaf of leaves) {
      if (drag.active) {
        const dx = leaf.x - drag.x;
        const dy = leaf.y - drag.y;
        const dist = Math.hypot(dx, dy) || 1;
        const influence = Math.max(0, 1 - dist / 95);
        leaf.vx += drag.vx * influence * 0.35;
        leaf.vy += drag.vy * influence * 0.35;
        leaf.av += ((dx * drag.vy) - (dy * drag.vx)) / (dist * dist) * 0.06;
      }
      leaf.vx *= 0.955;
      leaf.vy *= 0.955;
      leaf.vy += GRAVITY;
      leaf.av *= 0.97;
      leaf.x += leaf.vx;
      leaf.y += leaf.vy;
      leaf.angle += leaf.av;

      const nx = (leaf.x - cx) / rx;
      const ny = (leaf.y - cy) / ry;
      const n = Math.hypot(nx, ny);
      if (n > 1) {
        leaf.x = cx + (nx / n) * rx;
        leaf.y = cy + (ny / n) * ry;
        const ux = nx / n, uy = ny / n;
        const dot = leaf.vx * ux + leaf.vy * uy;
        if (dot > 0) {
          leaf.vx -= 2 * dot * ux;
          leaf.vy -= 2 * dot * uy;
          leaf.av += ((leaf.vx * uy) - (leaf.vy * ux)) * 0.05;
        }
        leaf.vx *= 0.72;
        leaf.vy *= 0.72;
      }
    }

    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i], b = leaves[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (dist < min && dist > 0.001) {
          const nx = dx / dist, ny = dy / dist;
          const overlap = (min - dist) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = -rel * 0.5;
            a.vx -= imp * nx; a.vy -= imp * ny;
            b.vx += imp * nx; b.vy += imp * ny;
            a.av += ((a.vx * ny) - (a.vy * nx)) * 0.06;
            b.av += ((b.vx * ny) - (b.vy * nx)) * 0.06;
          }
        }
      }
    }

    for (const leaf of leaves) {
      if (leaf.el) leaf.el.style.transform = `translate(${leaf.x}px, ${leaf.y}px) translate(-50%, -50%) rotate(${leaf.angle}deg)`;
    }
  }

  useEffect(() => {
    if (screen !== "wok-craft") return;
    let pollId = 0;
    let loopId = 0;
    const start = () => {
      const wok = wokRef.current;
      if (!wok) {
        pollId = requestAnimationFrame(start);
        return;
      }
      const rect = wok.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      particlesRef.current = Array.from({ length: LEAF_COUNT }, (_, i) => {
        const a = (i / LEAF_COUNT) * Math.PI * 2 + Math.random() * 0.6;
        const rad = Math.min(w, h) * (0.14 + Math.random() * 0.18);
        const leaf: WokLeaf = {
          el: leafElsRef.current[i] ?? null,
          x: w / 2 + Math.cos(a) * rad,
          y: h / 2 + Math.sin(a) * rad,
          vx: 0, vy: 0,
          angle: Math.random() * 360,
          av: (Math.random() - 0.5) * 4,
          r: 15 + Math.random() * 7,
        };
        if (leaf.el) leaf.el.style.transform = `translate(${leaf.x}px, ${leaf.y}px) translate(-50%, -50%) rotate(${leaf.angle}deg)`;
        return leaf;
      });
      dragRef.current = { x: w / 2, y: h / 2, vx: 0, vy: 0, active: false };
      const tick = () => { stepWokPhysics(wok); loopId = requestAnimationFrame(tick); };
      loopId = requestAnimationFrame(tick);
    };
    pollId = requestAnimationFrame(start);
    return () => { cancelAnimationFrame(pollId); cancelAnimationFrame(loopId); };
  }, [screen]);

  if (!detail) return <div className="empty">正在走进雾里…</div>;

  const completedAlready = detail.progress.status === "completed" && !replay;
  if (completedAlready || completion) {
    const collected = completion?.specimen;
    return (
      <section className="realm-complete-screen">
        <motion.div className="realm-complete-stage" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } } }}>
          {specimen ? (
            <motion.img className="realm-specimen-large" variants={copyItem} src={mediaUrl(specimen.url)} alt="白毫数字标本" />
          ) : null}
          <motion.p className="eyebrow" variants={copyItem}>已收进 Passport</motion.p>
          <motion.h1 variants={copyItem}>白毫</motion.h1>
          <motion.p variants={copyItem}>{collected?.description || "一枚来自《雾里一芽》的数字标本。"}</motion.p>
          <motion.div className="realm-complete-actions" variants={copyItem}>
            <Link className="button primary" href="/passport">查看茶护照</Link>
            <Link className="button" href="/realm">回到茶境</Link>
          </motion.div>
        </motion.div>
      </section>
    );
  }

  if (!started) {
    return (
      <section className="realm-cover">
        {mountain ? (
          <motion.img src={mediaUrl(mountain.url)} alt="风格化黔南山雾氛围" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 14, ease: "easeOut" }} />
        ) : null}
        <div className="realm-cover-shade" />
        <div className="realm-atmosphere" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        <Link className="realm-close" href="/realm" aria-label="返回茶境首页"><X size={21} /></Link>
        <motion.div className="realm-cover-copy" initial="hidden" animate="show" variants={copyVariants}>
          <motion.p className="realm-kicker" variants={copyItem}>Tea Realm 01 · {detail.definition.regionLabel}</motion.p>
          <motion.h1 variants={copyItem}>{detail.definition.title}</motion.h1>
          <motion.p variants={copyItem}>{detail.personalization.introCopy}</motion.p>
          <motion.button className="button primary block" variants={copyItem} disabled={busy} onClick={() => void enter()}>{busy ? "正在入雾…" : replay ? "重新进入" : "进入茶境"}</motion.button>
        </motion.div>
      </section>
    );
  }

  return (
    <MotionConfig reducedMotion={mode === "reducedMotion" ? "always" : "user"}>
      <section className={`realm-experience ${skipAnimations ? "skip-animations" : ""}`}>
        <div className="realm-scene-bg">
          {background ? (
            <motion.img
              key={screen}
              src={mediaUrl(background.url)}
              alt=""
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: skipAnimations ? 1 : [1, 1.055] }}
              transition={skipAnimations ? { duration: 0 } : { opacity: { duration: 0.9 }, scale: { duration: 20, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } }}
            />
          ) : null}
          <div className="realm-scene-tint" />
        </div>
        <div className="realm-atmosphere" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>

        <header className="realm-controls">
          <Link href="/realm" aria-label="退出茶境"><X size={18} /></Link>
          <div className="realm-dots" aria-label="场景进度">
            {detail.definition.sceneOrder.map((id, index) => (
              <span className={index <= sceneIndex ? "active" : ""} key={id} />
            ))}
          </div>
          <button onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "静音" : "开启声音"}>{soundOn ? <SpeakerHigh size={17} /> : <SpeakerSlash size={17} />}</button>
          <button onClick={() => setSkipAnimations((value) => !value)} aria-label="跳过动画"><FastForward size={17} weight={skipAnimations ? "fill" : "regular"} /></button>
        </header>

        <AnimatePresence mode="wait">
          <motion.div className="realm-scene" key={screen} variants={sceneVariants} initial="enter" animate="center" exit="exit">
            <motion.div className="realm-scene-copy" variants={copyVariants} initial="hidden" animate="show">
              <motion.p className="realm-kicker" variants={copyItem}>{scene?.eyebrow}</motion.p>
              <motion.h1 variants={copyItem}>{scene?.title}</motion.h1>
              {scene?.instruction ? <motion.p variants={copyItem}>{scene.instruction}</motion.p> : null}
            </motion.div>

            {screen === "liquor-entry" ? (
              <div className={`realm-liquor ${liquorTapped ? "tapped" : ""}`}>
                <img className="realm-liquor-img" src="/realm/liquor.png" alt="茶汤" />
                <motion.img
                  className="realm-liquor-img"
                  src="/realm/ripple.png"
                  alt="波纹"
                  initial={false}
                  animate={{ opacity: liquorTapped ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />
                {!liquorTapped ? <button className="realm-tap-pill" disabled={busy} onClick={tapLiquor}>轻触茶汤</button> : null}
              </div>
            ) : null}

            {screen === "mist-mountain" ? (
              <div className="realm-mist-full" role="group" tabIndex={0} aria-label="拨开雾层"
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return;
                  pointerRef.current = { x: event.clientX, y: event.clientY };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={handleMistPointer} onPointerUp={() => { pointerRef.current = null; }}
                onKeyDown={(event) => { if (event.key.startsWith("Arrow") || event.key === "Enter") setMistScore((value) => Math.min(100, value + 25)); }}>
                {mist ? (
                  <motion.img
                    className="realm-mist"
                    src={mediaUrl(mist.url)}
                    alt="可拨开的雾层"
                    style={{ WebkitMaskImage: mistMask, maskImage: mistMask }}
                    animate={{ x: mistDirSign * mistScore * 1.6, opacity: Math.max(0.05, 1 - mistScore / 90) }}
                  />
                ) : null}
                <div className="realm-drift" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
                <div className="realm-mist-ui">
                  <div className="realm-meter"><span style={{ width: `${mistScore}%` }} /></div>
                  <small>{mistScore >= 70 ? "雾散了，山出来了。" : mode === "orientation" ? "轻轻倾斜手机" : "左右拖动拨开雾"}</small>
                </div>
              </div>
            ) : null}

            {screen === "pick-bud" ? (
              <div className="realm-buds" aria-label="选择一芽一叶">
                {[
                  ["single", "只有一枚芽"], ["bud-leaf", "一芽一叶"], ["open", "两片已展开的叶"], ["stem", "带长梗的叶"],
                ].map(([id, label]) => (
                  <button key={id} className={`realm-bud ${budChosen && id === "bud-leaf" ? "chosen" : ""} ${shakeBud === id ? "shake" : ""}`} onClick={() => {
                    if (id === "bud-leaf") { setBudChosen(true); setWrongBud(""); tone(soundOn, 590); }
                    else { setWrongBud(BUD_HINTS[id] ?? "这一枚也在长大。再找找“一芽一叶”。"); setShakeBud(id); tone(soundOn, 220); }
                  }}>
                    <img className="realm-bud-img" src={BUD_IMAGES[id]} alt="" />
                    <span className="realm-bud-label">{label}</span>
                  </button>
                ))}
                <div className="realm-feedback" aria-live="polite">
                  <span>{budChosen ? "1 / 53,000+ · 这一片叶子很轻，人的劳动很重。" : wrongBud}</span>
                </div>
                {budChosen ? <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={() => void advance()}>把它带去锅边</motion.button> : null}
              </div>
            ) : null}

            {screen === "wok-craft" ? (
              <div className="realm-craft">
                <div className="realm-wok" ref={wokRef} data-craft={craftIndex} role="button" tabIndex={0} aria-label="制茶手势区域"
                  onPointerDown={onWokPointerDown}
                  onPointerMove={onWokPointerMove}
                  onPointerUp={onWokPointerUp}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setCraftIndex((value) => Math.min(craftSteps.length, value + 1)); }}>
                  <div className="realm-steam" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                  <div className="realm-tea-leaves" aria-hidden="true">
                    {Array.from({ length: LEAF_COUNT }).map((_, i) => (
                      <span key={i} className="realm-leaf-particle" ref={(el) => { leafElsRef.current[i] = el; }}>
                        <Leaf size={LEAF_SIZES[i % LEAF_SIZES.length]} weight="duotone" />
                      </span>
                    ))}
                  </div>
                  {craftIndex < craftSteps.length ? <strong>{craftSteps[craftIndex].gesture}</strong> : <strong>四手已经做完</strong>}
                </div>
                <div className="realm-craft-progress" aria-hidden="true"><span style={{ width: `${craftIndex / craftSteps.length * 100}%` }} /></div>
                <div className="realm-craft-list">
                  {craftSteps.map((step, index) => (
                    <div className={index < craftIndex ? "done" : index === craftIndex ? "active" : ""} key={step.name}>
                      <span>{index < craftIndex ? <Check size={12} weight="bold" /> : index + 1}</span>
                      <p><strong>{index < craftIndex ? step.name : index === craftIndex ? step.gesture : "···"}</strong>{index < craftIndex ? <small>{step.hint}</small> : null}</p>
                    </div>
                  ))}
                </div>
                {craftIndex >= craftSteps.length ? <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={() => void advance()}>去做最后的判断</motion.button> : null}
              </div>
            ) : null}

            {screen === "human-judgment" ? (
              <div className="realm-judgment" role="group" aria-label="判断何时停手">
                <motion.div className="realm-leaf-mass" style={{ background: `radial-gradient(circle, rgba(${Math.round(93 + maturity * 0.72)},${Math.round(127 - maturity * 0.88)},${Math.round(79 - maturity * 0.72)},.58), rgba(28,48,30,.14) 62%, transparent 64%)` }} animate={{ rotate: maturity * 0.28, scale: 1 + maturity * 0.001 }}>
                  <Grains size={80} weight="duotone" />
                </motion.div>
                <div className="realm-meter"><span style={{ width: `${maturity}%`, background: maturity > 75 ? "#d9a24a" : "#e3f2d7" }} /></div>
                <p>{heating ? "青气正在退去。盯紧火候，在合适的时刻按下停止。" : maturity >= 100 ? "炒过头了。再来一手。" : "还有一点青气，别急。再来一手。"}</p>
                <div className="realm-judgment-actions">
                  {heating ? (
                    <button className="button primary" onClick={stopHeating}>停止</button>
                  ) : (
                    <button className="button" onClick={retryHeat}>再来一手</button>
                  )}
                </div>
              </div>
            ) : null}

            {screen === "real-tea-reveal" ? (
              <div className="realm-real-reveal">
                <div className={`realm-real-frame ${realRevealed ? "revealed" : ""}`}>
                  <div className="realm-stylized-leaves"><Sparkle size={24} /><Plant size={68} weight="duotone" /><Leaf size={48} weight="duotone" /></div>
                  {dryTea ? <img src={mediaUrl(dryTea.url)} alt="论文 Figure 7A 中的都匀毛尖五级干茶对照" /> : null}
                  {realRevealed ? <span className="realm-real-sweep" aria-hidden="true" /> : null}
                </div>
                <p>{detail.personalization.userWords ? `你说“${detail.personalization.userWords}”。这一口的路，从雾里的一芽开始。` : "杯里轻盈的鲜，来自嫩叶、火候，也来自人在关键时刻的判断。"}</p>
                <small className="realm-credit">真实锚点：Xia et al. (2026), Food Chemistry: X, Fig. 7A, CC BY 4.0。论文样本，不代表商品批次。</small>
                {!realRevealed ? <button className="button primary" onClick={() => void revealRealTea()}>回到真实干茶</button> : <motion.button className="button primary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} disabled={busy} onClick={() => void advance()}>收下这一芽</motion.button>}
              </div>
            ) : null}

            {screen === "passport-specimen" ? (
              <div className="realm-collect">
                {specimen ? (
                  <div className="realm-specimen-wrap">
                    <motion.img src={mediaUrl(specimen.url)} alt="白毫数字标本" animate={{ y: [0, -8, 0] }} transition={{ duration: skipAnimations ? 0 : 2.5, repeat: Infinity }} />
                    <span className="realm-specimen-shine" aria-hidden="true" />
                  </div>
                ) : null}
                <p>完成后，白毫标本会进入你的茶护照，黔南也会在茶境地图上点亮。</p>
                <button className="button primary block" disabled={busy} onClick={() => void collect()}>{busy ? "正在收藏…" : "收进 Passport"}</button>
              </div>
            ) : null}

            {notice ? <p className="realm-notice" aria-live="polite">{notice}</p> : null}
          </motion.div>
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}