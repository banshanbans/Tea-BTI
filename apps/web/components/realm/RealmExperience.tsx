"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { FastForward, Grains, Leaf, Plant, Selection, SpeakerHigh, SpeakerSlash, Sparkle, Tree, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { BackControl } from "@/components/BackControl";
import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { RealmComplete, RealmDetail, RealmMutation } from "@/lib/api";
import { realmExitHref } from "@/lib/navigation";
import type { RealmEntry, TeaOrigin } from "@/lib/navigation";

type InteractionMode = "orientation" | "pointer" | "reducedMotion";
type FallbackReason = "permission_denied" | "unsupported" | "desktop" | "reduced_motion" | "sensor_error";

const craftSteps = [
  { name: "杀青", hint: "推开青气，让鲜叶停在当下。", gesture: "向前推" },
  { name: "揉捻", hint: "让叶片彼此靠近，汤感从这里开始聚。", gesture: "往复揉" },
  { name: "搓团", hint: "收紧叶形，把香气与质感留住。", gesture: "画一个圆" },
  { name: "提毫", hint: "最后一次轻搓，白毫才慢慢显出来。", gesture: "轻轻搓" },
] as const;

function BudIcon({ id }: { id: string }) {
  const props = { size: 42, weight: "duotone" as const };
  if (id === "single") return <Plant {...props} />;
  if (id === "bud-leaf") return <Leaf {...props} />;
  if (id === "open") return <Tree {...props} />;
  return <Selection {...props} />;
}

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
  const [wrongBud, setWrongBud] = useState("");
  const [budChosen, setBudChosen] = useState(false);
  const [craftIndex, setCraftIndex] = useState(0);
  const [craftDistance, setCraftDistance] = useState(0);
  const [maturity, setMaturity] = useState(0);
  const [realRevealed, setRealRevealed] = useState(false);
  const [completion, setCompletion] = useState<RealmComplete | null>(null);
  const sceneStartedRef = useRef(Date.now());
  const experienceStartedRef = useRef(Date.now());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

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
      if (typeof gamma === "number") setMistScore((value) => Math.min(100, value + Math.abs(gamma) / 6));
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

  async function advance() {
    if (!detail || !scene || busy) return;
    const next = detail.definition.sceneOrder[sceneIndex + 1];
    if (!next) return;
    if (detail.progress.completedScenes.includes(scene.id)) {
      setScreen(next);
      tone(soundOn, 560 + sceneIndex * 30);
      return;
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
    const distance = Math.abs(event.clientX - pointerRef.current.x) + Math.abs(event.clientY - pointerRef.current.y);
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setMistScore((value) => Math.min(100, value + distance / 3));
  }

  function handleCraftMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerRef.current || craftIndex >= craftSteps.length) return;
    const distance = Math.hypot(event.clientX - pointerRef.current.x, event.clientY - pointerRef.current.y);
    pointerRef.current = { x: event.clientX, y: event.clientY };
    const next = craftDistance + distance;
    if (next >= 105) {
      setCraftIndex((value) => Math.min(craftSteps.length, value + 1));
      setCraftDistance(0);
      tone(soundOn, 430 + craftIndex * 50);
    } else setCraftDistance(next);
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
        {specimen ? <img className="realm-specimen-large" src={mediaUrl(specimen.url)} alt="白毫数字标本" /> : null}
        <p className="eyebrow">已收进茶护照</p>
        <h1>白毫</h1>
        <p>{collected?.description || "一枚来自《雾里一芽》的数字标本。"}</p>
        <div className="realm-complete-actions">
          <Link className="button primary" href="/passport">查看茶护照</Link>
          <Link className="button" href={exitHref}>{entry === "tea" ? "返回茶详情" : "回到茶境"}</Link>
        </div>
      </section>
    );
  }

  if (!started) {
    return (
      <section className="realm-cover">
        {mountain ? <img src={mediaUrl(mountain.url)} alt="风格化黔南山雾氛围" /> : null}
        <div className="realm-cover-shade" />
        <Link className="realm-close" href={exitHref} aria-label={entry === "tea" ? "退出茶境并返回茶详情" : "退出茶境并返回茶境首页"}><X size={21} /></Link>
        <div className="realm-cover-copy">
          <p className="realm-kicker">茶境 01 · {detail.definition.regionLabel}</p>
          <h1>{detail.definition.title}</h1>
          <p>{detail.personalization.introCopy}</p>
          <p className="realm-cover-note">需要时会询问方向权限，也可以一直用拖拽。</p>
          <button className="button primary block" disabled={busy} onClick={() => void enter()}>{busy ? "正在入雾…" : replay ? "重新进入" : "进入茶境"}</button>
        </div>
      </section>
    );
  }

  return (
    <MotionConfig reducedMotion={mode === "reducedMotion" ? "always" : "user"}>
      <section className={`realm-experience ${skipAnimations ? "skip-animations" : ""}`}>
        <div className="realm-scene-bg">
          {mountain ? <img src={mediaUrl(sceneIndex >= 3 && workshop ? workshop.url : mountain.url)} alt="" /> : null}
          <div className="realm-scene-tint" />
        </div>

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
          <motion.div className="realm-scene" key={screen} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: skipAnimations ? 0 : .55 }}>
            <div className="realm-scene-copy">
              <p className="realm-kicker">{scene?.eyebrow}</p>
              <h1>{scene?.title}</h1>
              <p>{scene?.instruction}</p>
            </div>

            {screen === "liquor-entry" ? (
              <div className="realm-ripple-wrap">
                <motion.div className="realm-ripple" animate={skipAnimations ? {} : { scale: [1, 1.14, 1], opacity: [.7, .28, .7] }} transition={{ repeat: Infinity, duration: 2.8 }} />
                <button className="realm-center-action" disabled={busy} onClick={() => void advance()}>轻触茶汤</button>
              </div>
            ) : null}

            {screen === "mist-mountain" ? (
              <div className="realm-interaction mist-interaction" role="group" tabIndex={0} aria-label="拨开雾层"
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return;
                  pointerRef.current = { x: event.clientX, y: event.clientY };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={handleMistPointer} onPointerUp={() => { pointerRef.current = null; }}
                onKeyDown={(event) => { if (event.key.startsWith("Arrow") || event.key === "Enter") setMistScore((value) => Math.min(100, value + 25)); }}>
                {mist ? <motion.img className="realm-mist" src={mediaUrl(mist.url)} alt="可拨开的雾层" animate={{ x: mistScore * 1.4, opacity: Math.max(.06, 1 - mistScore / 90) }} /> : null}
                <div className="realm-meter"><span style={{ width: `${mistScore}%` }} /></div>
                <small>{mode === "orientation" ? "轻轻倾斜手机" : "左右拖动拨开雾"}</small>
                {mistScore >= 70 ? <button className="button primary" disabled={busy} onClick={() => void advance()}>山出现了</button> : null}
              </div>
            ) : null}

            {screen === "pick-bud" ? (
              <div className="realm-buds" aria-label="选择一芽一叶">
                {[
                  ["single", "只有一枚芽"], ["bud-leaf", "一芽一叶"], ["open", "两片已展开的叶"], ["stem", "带长梗的叶"],
                ].map(([id, label]) => (
                  <button key={id} className={`realm-bud ${budChosen && id === "bud-leaf" ? "chosen" : ""}`} onClick={() => {
                    if (id === "bud-leaf") { setBudChosen(true); setWrongBud(""); tone(soundOn, 590); }
                    else setWrongBud("这一枚也在长大。再找找“一芽一叶”。");
                  }}><span aria-hidden="true" className="bud-icon"><BudIcon id={id} /></span>{label}</button>
                ))}
                <p className="realm-feedback" aria-live="polite">{budChosen ? "1 / 53,000+ · 这一片叶子很轻，人的劳动很重。" : wrongBud}</p>
                {budChosen ? <button className="button primary" disabled={busy} onClick={() => void advance()}>把它带去锅边</button> : null}
              </div>
            ) : null}

            {screen === "wok-craft" ? (
              <div className="realm-craft">
                <div className="realm-wok" role="button" tabIndex={0} aria-label="制茶手势区域"
                  onPointerDown={(event) => { pointerRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
                  onPointerMove={handleCraftMove} onPointerUp={() => { pointerRef.current = null; }}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setCraftIndex((value) => Math.min(craftSteps.length, value + 1)); }}>
                  <motion.span className="craft-leaves" animate={{ rotate: craftIndex * 65, x: [0, 18, -12, 0] }} transition={{ duration: skipAnimations ? 0 : .8 }}><Leaf size={31} weight="duotone" /><Plant size={34} weight="duotone" /><Leaf size={27} weight="duotone" /></motion.span>
                  {craftIndex < craftSteps.length ? <strong>{craftSteps[craftIndex].gesture}</strong> : <strong>四手已经做完</strong>}
                </div>
                <div className="realm-craft-list">
                  {craftSteps.map((step, index) => <div className={index < craftIndex ? "done" : index === craftIndex ? "active" : ""} key={step.name}><span>{index + 1}</span><p><strong>{index < craftIndex ? step.name : index === craftIndex ? step.gesture : "···"}</strong>{index < craftIndex ? <small>{step.hint}</small> : null}</p></div>)}
                </div>
                {craftIndex >= craftSteps.length ? <button className="button primary" disabled={busy} onClick={() => void advance()}>去做最后的判断</button> : null}
              </div>
            ) : null}

            {screen === "human-judgment" ? (
              <div className="realm-judgment" role="group" aria-label="判断何时停手">
                <motion.div className="realm-leaf-mass" animate={{ rotate: maturity * 7, scale: 1 + maturity * .025 }}><Grains size={80} weight="duotone" /></motion.div>
                <div className="realm-meter"><span style={{ width: `${Math.min(100, maturity * 28)}%` }} /></div>
                <p>{maturity < 3 ? "再摸一次叶片的状态，停手的时刻由你来定。" : "青气渐退，叶子收紧。手感会告诉你什么时候停。"}</p>
                <button className="button" onClick={() => { setMaturity((value) => Math.min(4, value + 1)); tone(soundOn, 470 + maturity * 25); }}>再试一手</button>
                <button className="button primary" onClick={() => maturity >= 3 ? void advance() : setNotice("还有一点青气，别急，再试一手。")}>现在停</button>
              </div>
            ) : null}

            {screen === "real-tea-reveal" ? (
              <div className="realm-real-reveal">
                <div className={`realm-real-frame ${realRevealed ? "revealed" : ""}`}>
                  <div className="realm-stylized-leaves"><Sparkle size={24} /><Plant size={68} weight="duotone" /><Leaf size={48} weight="duotone" /></div>
                  {dryTea ? <img src={mediaUrl(dryTea.url)} alt="论文 Figure 7A 中的都匀毛尖五级干茶对照" /> : null}
                </div>
                <p>{detail.personalization.userWords ? `你说“${detail.personalization.userWords}”。这一口的路，从雾里的一芽开始。` : "杯里轻盈的鲜，来自嫩叶、火候，也来自人在关键时刻的判断。"}</p>
                <small className="realm-credit">实物参考：Xia et al. (2026), Food Chemistry: X, Fig. 7A, CC BY 4.0。论文样本与商品批次无关。</small>
                {!realRevealed ? <button className="button primary" onClick={() => void revealRealTea()}>回到真实干茶</button> : <button className="button primary" disabled={busy} onClick={() => void advance()}>收下这一芽</button>}
              </div>
            ) : null}

            {screen === "passport-specimen" ? (
              <div className="realm-collect">
                {specimen ? <motion.img src={mediaUrl(specimen.url)} alt="白毫数字标本" animate={{ y: [0, -8, 0] }} transition={{ duration: skipAnimations ? 0 : 2.5, repeat: Infinity }} /> : null}
                <p>收下白毫，茶护照多一枚标本，黔南也会亮起来。</p>
                <button className="button primary block" disabled={busy} onClick={() => void collect()}>{busy ? "正在收藏…" : "收进茶护照"}</button>
              </div>
            ) : null}

            {notice ? <p className="realm-notice" aria-live="polite">{notice}</p> : null}
            {error ? <div className="error realm-retry"><span>{error}</span><button className="button" onClick={() => { setError(""); }}>在这一幕再试一次</button></div> : null}
          </motion.div>
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}
