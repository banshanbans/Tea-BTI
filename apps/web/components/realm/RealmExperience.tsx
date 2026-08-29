"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { FastForward, SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackControl } from "@/components/BackControl";
import {
  BudPickerVisual,
  HumanJudgmentVisual,
  LiquorEntryVisual,
  MistMountainVisual,
  RealmAtmosphere,
  RealTeaRevealVisual,
  SpecimenCollectVisual,
  WokCraftVisual,
} from "@/components/realm/RealmSceneVisuals";
import { useRealmOrientation } from "@/components/realm/useRealmOrientation";
import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { RealmComplete, RealmDetail, RealmMutation } from "@/lib/api";
import { realmExitHref } from "@/lib/navigation";
import type { RealmEntry, TeaOrigin } from "@/lib/navigation";

type InteractionMode = "orientation" | "pointer" | "reducedMotion";
type FallbackReason = "permission_denied" | "unsupported" | "desktop" | "reduced_motion" | "sensor_error" | "sensor_timeout" | "microphone_denied" | "microphone_unsupported" | "microphone_error" | "microphone_timeout" | "multitouch_unsupported";

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
  const [wrongSelections, setWrongSelections] = useState<string[]>([]);
  const [teacherMessage, setTeacherMessage] = useState("");
  const [pickInputMode, setPickInputMode] = useState<"pointer" | "keyboard" | "reducedMotion">("pointer");
  const [budChosen, setBudChosen] = useState(false);
  const [maturity, setMaturity] = useState(0);
  const [realRevealed, setRealRevealed] = useState(false);
  const [completion, setCompletion] = useState<RealmComplete | null>(null);
  const sceneStartedRef = useRef(Date.now());
  const experienceStartedRef = useRef(Date.now());

  const recordFallback = useCallback((reason: FallbackReason) => {
    if (reason === "sensor_timeout") {
      setMode("pointer");
      setNotice("没有收到方向数据，已切换为触控操作。");
    } else if (reason.startsWith("microphone")) {
      setNotice("没有使用麦克风，改用手指擦开蒸汽。");
    } else if (reason === "multitouch_unsupported") {
      setNotice("当前设备不支持双指识别，提毫可用单指短距离往复完成。");
    }
    void authenticated<RealmMutation>(`/realms/${realmId}/events`, {
      method: "POST",
      ...jsonBody({ clientEventId: eventId("realm-fallback"), eventType: "realm_interaction_fallback_used", interactionMode: mode, fallbackReason: reason, sceneId: screen }),
    }).catch(() => undefined);
  }, [mode, realmId, screen]);
  const orientation = useRealmOrientation({ active: started && mode === "orientation", onSignalLost: () => recordFallback("sensor_timeout") });

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await authenticated<RealmDetail>(`/realms/${realmId}`);
      setDetail(response);
      const initial = replay ? response.definition.sceneOrder[0] : response.run?.currentScene || response.progress.currentScene;
      setScreen(initial);
      setMode(response.run?.interactionMode || response.progress.interactionMode || "pointer");
      if (response.run && !response.run.completedAt && !replay) setStarted(true);
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
    if (mode !== "orientation" || screen !== "mist-mountain" || Math.abs(orientation.gamma) < 3) return;
    setMistDirection(orientation.gamma > 0 ? 1 : -1);
    setMistScore((value) => Math.min(100, value + Math.abs(orientation.gamma) / 6));
  }, [mode, orientation.gamma, screen]);

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
  const teacherCorrection = assets.get("teacher_correction");
  const teacherObserve = assets.get("teacher_observe");
  const teacherExplain = assets.get("teacher_explain");
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
      setDetail({ ...detail, progress: response.progress, run: response.run });
      setScreen(response.run?.currentScene || response.progress.currentScene);
      setStarted(true);
      experienceStartedRef.current = Date.now();
      if (selected.fallbackReason) setNotice("已自动切换为拖拽操作，不影响体验。");
      tone(soundOn);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  async function advance(sceneResult?: Record<string, unknown>): Promise<boolean> {
    if (!detail || !detail.run || !scene || busy) return false;
    const next = detail.definition.sceneOrder[sceneIndex + 1];
    if (!next) return false;
    if (detail.run.completedScenes.includes(scene.id)) {
      setScreen(next);
      tone(soundOn, 560 + sceneIndex * 30);
      return true;
    }
    setBusy(true); setError("");
    try {
      const response = await authenticated<RealmMutation>(`/realms/${realmId}/progress`, {
        method: "PATCH",
        ...jsonBody({ clientEventId: eventId(`realm-scene-${scene.id}`), runId: detail.run.runId, completedScene: scene.id, sceneResult, elapsedMs: Date.now() - sceneStartedRef.current }),
      });
      setDetail({ ...detail, progress: response.progress, run: response.run });
      setScreen(response.run?.currentScene || next);
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
    if (!detail?.run || busy) return;
    setBusy(true); setError("");
    try {
      const response = await authenticated<RealmComplete>(`/realms/${realmId}/complete`, {
        method: "POST",
        ...jsonBody({ clientEventId: eventId("realm-complete"), runId: detail.run.runId, totalElapsedMs: Date.now() - experienceStartedRef.current, interactionMode: mode }),
      });
      setCompletion(response);
      setDetail({ ...detail, progress: response.progress, run: response.run, outcome: response.outcome });
      tone(soundOn, 720);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  function handleMistMovement(distance: number, direction: 1 | -1) {
    setMistDirection(direction);
    setMistScore((value) => Math.min(100, value + distance / 3));
  }

  function chooseBud(id: string, inputMode: "pointer" | "keyboard" | "reducedMotion") {
    if (id === "bud-leaf") {
      setBudChosen(true);
      setPickInputMode(inputMode);
      setWrongBud("");
      tone(soundOn, 590);
      return;
    }
    const copy: Record<string, string> = {
      "bud-single": "这个还嫩了点。",
      "bud-open": "这片已经舒展开了，再找更嫩的一芽一叶。",
      "bud-stem": "梗长了些，再看看芽和第一片叶靠得更近的。",
    };
    setWrongSelections((value) => [...value, id]);
    if (wrongSelections.length === 0) setTeacherMessage(copy[id] || "再观察一下芽与第一片叶。");
    else setWrongBud(copy[id] || "再找找一芽一叶。");
    tone(soundOn, 220);
  }

  function showPreviousScene() {
    if (!detail || busy || sceneIndex <= 0) return;
    const previous = detail.definition.sceneOrder[sceneIndex - 1];
    if (previous === "mist-mountain") setMistScore((value) => Math.max(value, 100));
    if (previous === "pick-bud") { setBudChosen(true); setWrongBud(""); }
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
    const outcome = completion?.outcome || detail.outcome;
    return (
      <section className="realm-complete-screen">
        <motion.div className="realm-complete-stage" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}>
          {specimen ? <motion.div className="realm-specimen-wrap realm-specimen-large-wrap" variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}><img className="realm-specimen-large" src={mediaUrl(specimen.url)} alt="白毫数字标本" /><span className="realm-specimen-shine" aria-hidden="true" /></motion.div> : null}
          <motion.p className="eyebrow" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>已收进茶护照</motion.p>
          <motion.h1 variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>{outcome?.title || "白毫"}</motion.h1>
          <motion.p variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>{outcome?.summary || collected?.description || "一枚来自《雾里一芽》的数字标本。"}</motion.p>
          {outcome ? <motion.small className="realm-outcome-note" variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>{outcome.disclaimer}</motion.small> : null}
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

            {screen === "pick-bud" ? <BudPickerVisual assetUrls={budAssetUrls} observerUrl={teacherObserve ? mediaUrl(teacherObserve.url) : undefined} teacherUrl={teacherCorrection ? mediaUrl(teacherCorrection.url) : undefined} chosen={budChosen} feedback={wrongBud} teacherMessage={teacherMessage} busy={busy} reducedMotion={mode === "reducedMotion"} onChoose={chooseBud} onAdvance={() => advance({ kind: "pick-bud", selectedBud: "bud-leaf", wrongSelections, teacherShown: wrongSelections.length > 0, inputMode: pickInputMode })} /> : null}

            {screen === "wok-craft" ? <WokCraftVisual animated={!skipAnimations && mode !== "reducedMotion"} busy={busy} mode={mode} gamma={orientation.gamma} tiltRef={orientation.tiltRef} onFallback={(reason) => recordFallback(reason as FallbackReason)} onTone={(index) => tone(soundOn, 430 + index * 50)} onAdvance={advance} /> : null}

            {screen === "human-judgment" ? <HumanJudgmentVisual teacherUrl={teacherExplain ? mediaUrl(teacherExplain.url) : undefined} maturity={maturity} onTry={() => { setMaturity((value) => Math.min(5, value + 1)); tone(soundOn, 470 + maturity * 25); }} onStop={(stopWindow) => void advance({ kind: "human-judgment", maturityLevel: maturity, stopWindow })} /> : null}

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
