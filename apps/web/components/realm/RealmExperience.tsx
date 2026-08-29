"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { FastForward, SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackControl } from "@/components/BackControl";
import {
  BudPickerVisual,
  craftSteps,
  HumanJudgmentVisual,
  LiquorEntryVisual,
  MistMountainVisual,
  RealmAtmosphere,
  RealTeaRevealVisual,
  SpecimenCollectVisual,
  WokCraftVisual,
} from "@/components/realm/RealmSceneVisuals";
import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { RealmComplete, RealmDetail, RealmMutation } from "@/lib/api";
import { realmExitHref } from "@/lib/navigation";
import type { RealmEntry, TeaOrigin } from "@/lib/navigation";

type InteractionMode = "orientation" | "pointer" | "reducedMotion";
type FallbackReason = "permission_denied" | "unsupported" | "desktop" | "reduced_motion" | "sensor_error";

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

export function RealmExperience({ realmId, replay, entry = "realm", origin = "swipe", sourceTeaId }: {
  realmId: string;
  replay: boolean;
  entry?: RealmEntry;
  origin?: TeaOrigin;
  sourceTeaId?: string;
}) {
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
  const [mistDirection, setMistDirection] = useState<1 | -1>(1);
  const [wrongBud, setWrongBud] = useState("");
  const [budChosen, setBudChosen] = useState(false);
  const [craftIndex, setCraftIndex] = useState(0);
  const [craftDistance, setCraftDistance] = useState(0);
  const [maturity, setMaturity] = useState(0);
  const [realRevealed, setRealRevealed] = useState(false);
  const [completion, setCompletion] = useState<RealmComplete | null>(null);
  const sceneStartedRef = useRef(Date.now());
  const experienceStartedRef = useRef(Date.now());

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
  useEffect(() => { sceneStartedRef.current = Date.now(); setNotice(""); }, [screen]);

  useEffect(() => {
    if (mode !== "orientation" || screen !== "mist-mountain") return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma;
      if (typeof gamma === "number") {
        if (Math.abs(gamma) > 2) setMistDirection(gamma > 0 ? 1 : -1);
        setMistScore((value) => Math.min(100, value + Math.abs(gamma) / 6));
      }
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [mode, screen]);

  const assets = useMemo(() => new Map(detail?.definition.assets.map((asset) => [asset.role, asset]) || []), [detail]);
  const sceneIndex = detail ? detail.definition.sceneOrder.indexOf(screen) : 0;
  const scene = detail?.definition.scenes.find((item) => item.id === screen);
  const mountain = assets.get("mountain_background");
  const mist = assets.get("mist_overlay");
  const workshop = assets.get("workshop_background");
  const dryTea = assets.get("dry_tea_reveal");
  const specimen = assets.get("specimen_card");
  const liquor = assets.get("liquor_base");
  const ripple = assets.get("liquor_ripple");
  const budAssetUrls = useMemo(() => {
    const urls = new Map<string, string>();
    for (const role of ["bud_single", "bud_leaf", "bud_open", "bud_stem"]) {
      const asset = assets.get(role);
      if (asset) urls.set(role, mediaUrl(asset.url));
    }
    return urls;
  }, [assets]);
  const background = useMemo(() => {
    if (["wok-craft", "human-judgment", "real-tea-reveal"].includes(screen)) return workshop;
    if (["liquor-entry", "passport-specimen"].includes(screen)) return mist;
    return mountain;
  }, [screen, mist, mountain, workshop]);
  const validSourceTeaId = !detail || detail.definition.teaId === sourceTeaId ? sourceTeaId : undefined;
  const exitHref = realmExitHref(entry, validSourceTeaId, origin);

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
      if (selected.fallbackReason) setNotice("已自动切换为拖拽操作，不影响体验。");
      tone(soundOn);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  async function advance(): Promise<boolean> {
    if (!detail || !scene || busy) return false;
    const next = detail.definition.sceneOrder[sceneIndex + 1];
    if (!next) return false;
    if (detail.progress.completedScenes.includes(scene.id)) {
      setScreen(next);
      tone(soundOn, 560 + sceneIndex * 30);
      return true;
    }
    setBusy(true); setError("");
    try {
      const response = await authenticated<RealmMutation>(`/realms/${realmId}/progress`, {
        method: "PATCH",
        ...jsonBody({ clientEventId: eventId(`realm-scene-${scene.id}`), completedScene: scene.id, elapsedMs: Date.now() - sceneStartedRef.current }),
      });
      setDetail({ ...detail, progress: response.progress });
      setScreen(replay ? next : response.progress.currentScene);
      tone(soundOn, 560 + sceneIndex * 30);
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
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

  function handleMistMovement(distance: number, direction: 1 | -1) {
    setMistDirection(direction);
    setMistScore((value) => Math.min(100, value + distance / 3));
  }

  function handleCraftDistance(distance: number) {
    if (craftIndex >= craftSteps.length) return;
    const next = craftDistance + distance;
    if (next >= 105) {
      setCraftIndex((value) => Math.min(craftSteps.length, value + 1));
      setCraftDistance(0);
      tone(soundOn, 430 + craftIndex * 50);
    } else setCraftDistance(next);
  }

  function chooseBud(id: string) {
    if (id === "bud-leaf") {
      setBudChosen(true);
      setWrongBud("");
      tone(soundOn, 590);
      return;
    }
    setWrongBud("这一枚也在长大。再找找“一芽一叶”。");
    tone(soundOn, 220);
  }

  function showPreviousScene() {
    if (!detail || busy || sceneIndex <= 0) return;
    const previous = detail.definition.sceneOrder[sceneIndex - 1];
    if (previous === "mist-mountain") setMistScore((value) => Math.max(value, 100));
    if (previous === "pick-bud") { setBudChosen(true); setWrongBud(""); }
    if (previous === "wok-craft") { setCraftIndex(craftSteps.length); setCraftDistance(0); }
    if (previous === "human-judgment") setMaturity((value) => Math.max(value, 3));
    if (previous === "real-tea-reveal") setRealRevealed(true);
    setScreen(previous);
  }

  if (!detail) return <section className="realm-loading-screen">
    <Link className="realm-loading-exit" href={exitHref} aria-label={entry === "tea" ? "退出茶境并返回茶详情" : "退出茶境并返回茶境首页"}><X size={21} /></Link>
    <div className="empty">{error || "雾正在从杯里升起…"}</div>
  </section>;

  const completedAlready = detail.progress.status === "completed" && !replay;
  if (completedAlready || completion) {
    const collected = completion?.specimen;
    return (
      <section className="realm-complete-screen">
        <motion.div className="realm-complete-stage" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}>
          {specimen ? <motion.div className="realm-specimen-wrap realm-specimen-large-wrap" variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}><img className="realm-specimen-large" src={mediaUrl(specimen.url)} alt="白毫数字标本" /><span className="realm-specimen-shine" aria-hidden="true" /></motion.div> : null}
          <motion.p className="eyebrow" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>已收进茶护照</motion.p>
          <motion.h1 variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>白毫</motion.h1>
          <motion.p variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>{collected?.description || "一枚来自《雾里一芽》的数字标本。"}</motion.p>
          <motion.div className="realm-complete-actions" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
            <Link className="button primary" href="/passport">查看茶护照</Link>
            <Link className="button" href={exitHref}>{entry === "tea" ? "返回茶详情" : "回到茶境"}</Link>
          </motion.div>
        </motion.div>
      </section>
    );
  }

  if (!started) {
    return (
      <section className="realm-cover">
        {mountain ? <motion.img src={mediaUrl(mountain.url)} alt="风格化黔南山雾氛围" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 12, ease: "easeOut" }} /> : null}
        <div className="realm-cover-shade" />
        <RealmAtmosphere />
        <Link className="realm-close" href={exitHref} aria-label={entry === "tea" ? "退出茶境并返回茶详情" : "退出茶境并返回茶境首页"}><X size={21} /></Link>
        <motion.div className="realm-cover-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="realm-kicker">茶境 01 · {detail.definition.regionLabel}</p>
          <h1>{detail.definition.title}</h1>
          <p>{detail.personalization.introCopy}</p>
          <p className="realm-cover-note">需要时会询问方向权限，也可以一直用拖拽。</p>
          <button className="button primary block" disabled={busy} onClick={() => void enter()}>{busy ? "正在入雾…" : replay ? "重新进入" : "进入茶境"}</button>
        </motion.div>
      </section>
    );
  }

  return (
    <MotionConfig reducedMotion={mode === "reducedMotion" ? "always" : "user"}>
      <section className={`realm-experience ${skipAnimations ? "skip-animations" : ""}`}>
        <div className="realm-scene-bg">
          {background ? <motion.img key={background.assetId} src={mediaUrl(background.url)} alt="" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: skipAnimations ? 1 : [1, 1.04] }} transition={skipAnimations ? { duration: 0 } : { opacity: { duration: 0.7 }, scale: { duration: 18, repeat: Infinity, repeatType: "reverse" } }} /> : null}
          <div className="realm-scene-tint" />
        </div>
        <RealmAtmosphere />

        <header className="realm-controls">
          <Link href={exitHref} aria-label={entry === "tea" ? "退出茶境并返回茶详情" : "退出茶境并返回茶境首页"}><X size={18} /></Link>
          {sceneIndex > 0 ? <BackControl ariaLabel="返回上一幕" disabled={busy} onClick={showPreviousScene} /> : <span className="realm-back-placeholder" aria-hidden="true" />}
          <div className="realm-dots" aria-label={`第 ${sceneIndex + 1} 幕，共 7 幕`}>
            {detail.definition.sceneOrder.map((id, index) => <span className={index <= sceneIndex ? "active" : ""} key={id} />)}
          </div>
          <button onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "静音" : "开启声音"}>{soundOn ? <SpeakerHigh size={17} /> : <SpeakerSlash size={17} />}</button>
          <button onClick={() => setSkipAnimations((value) => !value)} aria-label="跳过动画"><FastForward size={17} weight={skipAnimations ? "fill" : "regular"} /></button>
        </header>

        <AnimatePresence mode="wait">
          <motion.div className="realm-scene" key={screen} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: skipAnimations ? 0 : .35 }}>
            <div className="realm-scene-copy">
              <p className="realm-kicker">{scene?.eyebrow}</p>
              <h1>{scene?.title}</h1>
              <p>{scene?.instruction}</p>
            </div>

            {screen === "liquor-entry" ? <LiquorEntryVisual liquorUrl={liquor ? mediaUrl(liquor.url) : undefined} rippleUrl={ripple ? mediaUrl(ripple.url) : undefined} busy={busy} skipAnimations={skipAnimations || mode === "reducedMotion"} onAdvance={advance} /> : null}

            {screen === "mist-mountain" ? <MistMountainVisual mistUrl={mist ? mediaUrl(mist.url) : undefined} score={mistScore} direction={mistDirection} mode={mode} busy={busy} onMove={handleMistMovement} onKeyboard={() => setMistScore((value) => Math.min(100, value + 25))} onAdvance={advance} /> : null}

            {screen === "pick-bud" ? <BudPickerVisual assetUrls={budAssetUrls} chosen={budChosen} feedback={wrongBud} busy={busy} onChoose={chooseBud} onAdvance={advance} /> : null}

            {screen === "wok-craft" ? <WokCraftVisual craftIndex={craftIndex} animated={!skipAnimations && mode !== "reducedMotion"} busy={busy} onDistance={handleCraftDistance} onKeyboardStep={() => setCraftIndex((value) => Math.min(craftSteps.length, value + 1))} onAdvance={advance} /> : null}

            {screen === "human-judgment" ? <HumanJudgmentVisual maturity={maturity} onTry={() => { setMaturity((value) => Math.min(4, value + 1)); tone(soundOn, 470 + maturity * 25); }} onStop={() => maturity >= 3 ? void advance() : setNotice("还有一点青气，别急，再试一手。")} /> : null}

            {screen === "real-tea-reveal" ? <RealTeaRevealVisual dryTeaUrl={dryTea ? mediaUrl(dryTea.url) : undefined} revealed={realRevealed} userWords={detail.personalization.userWords} busy={busy} onReveal={() => void revealRealTea()} onAdvance={advance} /> : null}

            {screen === "passport-specimen" ? <SpecimenCollectVisual specimenUrl={specimen ? mediaUrl(specimen.url) : undefined} skipAnimations={skipAnimations || mode === "reducedMotion"} busy={busy} onCollect={() => void collect()} /> : null}

            {notice ? <p className="realm-notice" aria-live="polite">{notice}</p> : null}
            {error ? <div className="error realm-retry"><span>{error}</span><button className="button" onClick={() => { setError(""); }}>在这一幕再试一次</button></div> : null}
          </motion.div>
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}
