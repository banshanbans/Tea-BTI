"use client";

import Link from "next/link";
import {
  ArrowRight, BowlSteam, Camera, CameraSlash, Check, CheckCircle, Microphone,
  Pause, Play, Plus, StopCircle, Timer, X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BackControl } from "@/components/BackControl";
import {
  abortVoiceSessionBestEffort, authenticated, authenticatedBinary, jsonBody,
} from "@/lib/api";
import type {
  BrewEventResult, BrewState, TeaDetail, VisionObservation, VoiceSession, VoiceStop, VoiceTurnsResult,
} from "@/lib/api";
import { teaDetailHref, teaStepHref } from "@/lib/navigation";
import type { TeaOrigin } from "@/lib/navigation";
import { RtcVoiceClient } from "@/lib/rtc";
import type { TranscriptTurn } from "@/lib/rtc";

type RecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null;
};

type WakeLockSentinelLike = { release: () => Promise<void> };
type ApiFailure = Error & { code?: string; status?: number };

const NEXT_STAGE: Record<string, BrewState["currentStage"] | undefined> = {
  prepare: "warm_vessel",
  warm_vessel: "add_leaves",
  add_leaves: "pour",
  pour: "steep",
  steep: "decant",
  decant: "taste",
};

const VISION_TARGET: Record<string, BrewState["currentStage"]> = {
  leaves_present: "pour",
  water_pouring: "steep",
  decanting: "decant",
};

const VISION_PROMPT: Record<string, string> = {
  leaves_present: "我看到像是已经投茶，要进入注水吗？",
  water_pouring: "我看到像是已经注水，要现在开始计时吗？",
  decanting: "我看到像是在出汤，要结束这一泡的计时吗？",
};

const FEEDBACKS = [
  ["too_light", "有点淡"], ["balanced", "正好"], ["too_strong", "有点浓"],
  ["bitter", "有点苦"], ["astringent", "有点涩"], ["too_hot", "有点烫"], ["too_cool", "有点凉"],
] as const;

function resumeStorageKey(teaId: string): string {
  return `tea-bti.brew-session.${teaId}`;
}

function parseWaterVolume(value: string): number {
  return Number(value.match(/\d+/)?.[0] || 150);
}

function stageLabel(stage: BrewState["currentStage"], state: BrewState | null): string {
  const glass = state?.vessel.includes("玻璃");
  const matcha = state?.isMatcha;
  const labels: Record<BrewState["currentStage"], string> = {
    prepare: "准备",
    warm_vessel: matcha ? "温碗" : "温杯",
    add_leaves: matcha ? "加粉" : "投茶",
    pour: "注水",
    steep: matcha ? "打匀" : "浸泡",
    decant: glass || matcha ? "可以喝" : "出汤",
    taste: "品饮",
    complete: "完成",
  };
  return labels[stage];
}

function formatSeconds(value: number | null): string {
  if (value === null) return "--:--";
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

async function jpegFrame(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const encode = (quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  let blob = await encode(.72);
  if (blob && blob.size > 250_000) blob = await encode(.52);
  if (blob && blob.size > 250_000) blob = await encode(.36);
  return blob && blob.size <= 250_000 ? blob : null;
}

export function BrewCompanionExperience({ teaId, origin = "swipe" }: { teaId: string; origin?: TeaOrigin }) {
  const [tea, setTea] = useState<TeaDetail | null>(null);
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [brewState, setBrewState] = useState<BrewState | null>(null);
  const [completion, setCompletion] = useState<VoiceStop | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [status, setStatus] = useState("准备好后，我们就开始");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cameraWanted, setCameraWanted] = useState(true);
  const [cameraWorking, setCameraWorking] = useState(false);
  const [visionWorking, setVisionWorking] = useState(true);
  const [visionPrompt, setVisionPrompt] = useState<string | null>(null);
  const [visionTarget, setVisionTarget] = useState<BrewState["currentStage"] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [vessel, setVessel] = useState("");
  const [waterVolumeMl, setWaterVolumeMl] = useState(150);
  const [text, setText] = useState("");
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [rtcFailed, setRtcFailed] = useState(false);
  const rtcRef = useRef<RtcVoiceClient | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const pausedRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const visionInFlightRef = useRef(false);
  const pendingWritesRef = useRef<Set<Promise<void>>>(new Set());
  const warnedFiveRef = useRef<string | null>(null);
  const warnedDoneRef = useRef<string | null>(null);
  const autoFinishRef = useRef(false);
  const finishingRef = useRef(false);
  const active = session?.status === "active";
  const isMock = session?.providerMode === "browser_mock";

  useEffect(() => {
    authenticated<TeaDetail>(`/teas/${teaId}`)
      .then((result) => {
        setTea(result);
        setVessel(result.brewingGuide.vessel.split("或")[0]);
        setWaterVolumeMl(parseWaterVolume(result.brewingGuide.waterVolume));
      })
      .catch(() => setError("这杯茶的资料还没准备好。"));
  }, [teaId]);

  useEffect(() => {
    const stored = window.localStorage.getItem(resumeStorageKey(teaId));
    if (!stored) return;
    authenticated<BrewState>(`/voice/sessions/${stored}/brew-state`)
      .then((result) => {
        if (result.status !== "active") {
          window.localStorage.removeItem(resumeStorageKey(teaId));
          return;
        }
        setResumeSessionId(stored);
        applyState(result, "上次陪泡还在，可以从当前阶段继续");
      })
      .catch(() => window.localStorage.removeItem(resumeStorageKey(teaId)));
    // A stored id is scoped to this tea and is only used to recover server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teaId]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && cameraStreamRef.current && video.srcObject !== cameraStreamRef.current) {
      video.srcObject = cameraStreamRef.current;
      void video.play().catch(() => undefined);
    }
  }, [cameraWorking, active]);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch {}
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    void wakeLockRef.current?.release().catch(() => undefined);
    void rtcRef.current?.disconnect().catch(() => undefined);
    // Keep the server run alive across refresh/navigation. It expires after the
    // Brew TTL or is explicitly completed; only failed preparation is aborted.
  }, []);

  function speak(value: string) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function applyState(next: BrewState | null | undefined, message?: string | null) {
    if (next) {
      setBrewState(next);
      if (next.pendingVisionEvent) {
        setVisionTarget(VISION_TARGET[next.pendingVisionEvent] || null);
        setVisionPrompt(VISION_PROMPT[next.pendingVisionEvent] || null);
      } else {
        setVisionPrompt(null);
        setVisionTarget(null);
      }
    }
    if (message) setStatus(message);
  }

  async function persistTurn(turn: TranscriptTurn) {
    const current = sessionRef.current;
    if (!current) return;
    const result = await authenticated<VoiceTurnsResult>(`/voice/sessions/${current.voiceSessionId}/turns`, {
      method: "POST", ...jsonBody({ turns: [turn] }),
    });
    applyState(result.brewState, result.actionMessage);
    if (isMock && result.actionMessage) speak(result.actionMessage);
  }

  function addTurn(turn: TranscriptTurn) {
    setTurns((current) => current.some((item) => item.clientTurnId === turn.clientTurnId) ? current : [...current, turn]);
    if (turn.role === "user") {
      const value = turn.text.trim();
      if (value.includes("暂停听我说") || value === "暂停") {
        pausedRef.current = true; setPaused(true);
        if (sessionRef.current?.providerMode === "browser_mock") recognitionRef.current?.stop();
        else void rtcRef.current?.pauseCapture();
      } else if (["继续", "继续听", "继续吧"].includes(value)) {
        pausedRef.current = false; setPaused(false);
        if (sessionRef.current?.providerMode === "browser_mock") startRecognition();
        else void rtcRef.current?.resumeCapture();
      }
    }
    let request: Promise<void>;
    request = persistTurn(turn).catch(() => setError("这一句已经听见了，但状态同步失败，请再说一次。"))
      .finally(() => pendingWritesRef.current.delete(request));
    pendingWritesRef.current.add(request);
  }

  async function requestDevices(): Promise<{ audio: boolean; video: boolean }> {
    if (!navigator.mediaDevices?.getUserMedia) return { audio: false, video: false };
    if (cameraWanted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 720 }, height: { ideal: 720 } },
        });
        stream.getAudioTracks().forEach((track) => track.stop());
        cameraStreamRef.current = stream;
        setCameraWorking(stream.getVideoTracks().length > 0);
        return { audio: true, video: stream.getVideoTracks().length > 0 };
      } catch {
        setCameraWorking(false);
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return { audio: true, video: false };
    } catch {
      return { audio: false, video: false };
    }
  }

  async function requestWakeLock() {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wakeLock) return;
    wakeLockRef.current = await wakeLock.request("screen").catch(() => null);
  }

  async function start() {
    if (busy || !tea) return;
    setBusy(true); setError(""); setStatus("正在接上茶伴");
    try {
      const permissions = await requestDevices();
      const prepared = await authenticated<VoiceSession>("/voice/sessions", {
        method: "POST",
        ...jsonBody({
          mode: "brew",
          teaId,
          cameraEnabled: permissions.video,
          brewSetup: { vessel, waterVolumeMl },
        }),
      });
      window.localStorage.setItem(resumeStorageKey(teaId), prepared.voiceSessionId);
      setResumeSessionId(prepared.voiceSessionId);
      setSession(prepared); sessionRef.current = prepared; applyState(prepared.brewState);
      if (prepared.providerMode === "volcengine_rtc") {
        if (!permissions.audio) throw new Error("没有麦克风权限");
        const rtc = new RtcVoiceClient();
        rtcRef.current = rtc;
        await rtc.connect(
          prepared,
          addTurn,
          (message) => setStatus(message),
          (message) => { setRtcFailed(true); setError(message); },
        );
      }
      const started = await authenticated<VoiceSession>(`/voice/sessions/${prepared.voiceSessionId}/start`, { method: "POST" });
      setSession(started); sessionRef.current = started; applyState(started.brewState, "正在聆听，直接说话");
      if (started.providerMode === "browser_mock") speak(started.welcomeMessage);
      await requestWakeLock();
    } catch (cause) {
      const prepared = sessionRef.current;
      try { await rtcRef.current?.disconnect(); } catch {}
      rtcRef.current = null;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraWorking(false);
      if (prepared && prepared.status !== "active") {
        abortVoiceSessionBestEffort(prepared.voiceSessionId);
        window.localStorage.removeItem(resumeStorageKey(teaId));
        setResumeSessionId(null);
        sessionRef.current = null;
        setSession(null);
      }
      const message = (cause as Error).message || "茶伴还没接上，请稍后重试。";
      setError(message.includes("麦克风") ? "麦克风没有接上。仍可返回后重新授权。" : message);
      setStatus("连接失败");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!resumeSessionId || busy) return;
    setBusy(true); setError(""); setStatus("正在恢复这次陪泡");
    try {
      const permissions = await requestDevices();
      const resumed = await authenticated<VoiceSession>(`/voice/sessions/${resumeSessionId}/start`, { method: "POST" });
      if (resumed.providerMode === "volcengine_rtc") {
        if (!permissions.audio) throw new Error("没有麦克风权限");
        const rtc = new RtcVoiceClient();
        rtcRef.current = rtc;
        await rtc.connect(resumed, addTurn, (message) => setStatus(message), (message) => { setRtcFailed(true); setError(message); });
      }
      setSession(resumed); sessionRef.current = resumed; applyState(resumed.brewState, "已回到刚才的阶段");
      if (resumed.providerMode === "browser_mock") speak("我们接着刚才的阶段继续。");
      setRtcFailed(false);
      await requestWakeLock();
    } catch (cause) {
      setError((cause as Error).message || "这次陪泡暂时恢复不了，请稍后再试。");
      setStatus("恢复失败");
    } finally {
      setBusy(false);
    }
  }

  async function reconnectRtc() {
    const current = sessionRef.current;
    if (!current || current.providerMode !== "volcengine_rtc" || busy) return;
    setBusy(true); setError(""); setStatus("正在重新连接实时语音");
    try {
      await rtcRef.current?.disconnect().catch(() => undefined);
      const refreshed = await authenticated<VoiceSession>(`/voice/sessions/${current.voiceSessionId}/start`, { method: "POST" });
      const rtc = new RtcVoiceClient();
      rtcRef.current = rtc;
      await rtc.connect(refreshed, addTurn, (message) => setStatus(message), (message) => { setRtcFailed(true); setError(message); });
      if (paused) await rtc.pauseCapture();
      setSession(refreshed); sessionRef.current = refreshed; applyState(refreshed.brewState, "实时语音已重新连接");
      setRtcFailed(false);
    } catch (cause) {
      setError((cause as Error).message || "实时语音还没接回来，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function sendEvent(payload: Record<string, unknown>) {
    if (!sessionRef.current) return null;
    setBusy(true); setError("");
    try {
      const result = await authenticated<BrewEventResult>(`/voice/sessions/${sessionRef.current.voiceSessionId}/brew/events`, {
        method: "POST",
        ...jsonBody({ clientEventId: crypto.randomUUID(), source: "touch", ...payload }),
      });
      applyState(result.brewState, result.message);
      if (isMock) speak(result.message);
      return result;
    } catch (cause) {
      setError((cause as Error).message || "这一步还没记下，请再试一次。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmVision() {
    if (!visionTarget || !sessionRef.current || busy) return;
    setBusy(true); setError("");
    try {
      const result = await authenticated<BrewEventResult>(`/voice/sessions/${sessionRef.current.voiceSessionId}/brew/events`, {
        method: "POST",
        ...jsonBody({ clientEventId: crypto.randomUUID(), eventType: "confirm_stage", source: "camera_confirmed", stage: visionTarget }),
      });
      applyState(result.brewState, result.message);
      if (isMock) speak(result.message);
    } catch (cause) {
      setError((cause as Error).message || "还没确认成功，请再说一次或点一下。" );
    } finally {
      setBusy(false);
    }
  }

  async function declineVision() {
    await sendEvent({ eventType: "decline_vision" });
  }

  useEffect(() => {
    if (!active || !brewState?.cameraEnabled || !cameraWorking || !visionWorking) return;
    if (!["add_leaves", "pour", "steep"].includes(brewState.currentStage)) return;
    const sessionId = session.voiceSessionId;
    const timer = window.setInterval(async () => {
      if (visionInFlightRef.current || !videoRef.current) return;
      visionInFlightRef.current = true;
      try {
        const frame = await jpegFrame(videoRef.current);
        if (!frame) return;
        const result = await authenticatedBinary<VisionObservation>(
          `/voice/sessions/${sessionId}/vision/observations?stage=${brewState.currentStage}&infusionNumber=${brewState.infusionNumber}`,
          frame,
        );
        applyState(result.brewState);
        if (result.candidate) {
          setVisionPrompt(result.prompt || null);
          setVisionTarget(result.targetStage || null);
        }
      } catch (cause) {
        const error = cause as ApiFailure;
        if (error.code === "VISION_UNAVAILABLE") {
          setVisionWorking(false);
          setError("画面判断暂时不可用，继续用语音陪泡。");
        }
      } finally {
        visionInFlightRef.current = false;
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, brewState?.cameraEnabled, brewState?.currentStage, brewState?.infusionNumber, cameraWorking, visionWorking, session?.voiceSessionId]);

  useEffect(() => {
    if (!brewState?.deadlineAt) { setRemaining(null); return; }
    const deadlineKey = brewState.deadlineAt;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(deadlineKey).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 5 && warnedFiveRef.current !== deadlineKey) {
        warnedFiveRef.current = deadlineKey;
        speak("还有五秒。");
      }
      if (seconds === 0 && warnedDoneRef.current !== deadlineKey) {
        warnedDoneRef.current = deadlineKey;
        speak(brewState.vessel.includes("玻璃") ? "时间到了，可以品饮。" : "时间到了，可以出汤。");
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    const onVisible = () => update();
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [brewState?.deadlineAt, brewState?.vessel]);

  useEffect(() => {
    const sync = () => {
      const current = sessionRef.current;
      if (document.visibilityState !== "visible" || !current || current.status !== "active") return;
      void authenticated<BrewState>(`/voice/sessions/${current.voiceSessionId}/brew-state`)
        .then((result) => applyState(result, "时间和阶段已同步"))
        .catch(() => setError("网络还没恢复，本地计时会继续。"));
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    return () => { document.removeEventListener("visibilitychange", sync); window.removeEventListener("pageshow", sync); };
  }, []);

  async function toggleCapture() {
    if (!active || busy) return;
    setBusy(true);
    try {
      if (isMock) {
        if (paused) {
          pausedRef.current = false; setPaused(false); startRecognition();
        } else {
          pausedRef.current = true; setPaused(true); recognitionRef.current?.stop();
        }
      } else if (paused) {
        await rtcRef.current?.resumeCapture(); pausedRef.current = false; setPaused(false);
      } else {
        await rtcRef.current?.pauseCapture(); pausedRef.current = true; setPaused(true);
      }
    } finally { setBusy(false); }
  }

  function startRecognition() {
    const scope = window as typeof window & { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) { setError("这台浏览器暂时听不见你，可以使用屏幕按钮。"); return; }
    const recognition = new Constructor();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => {
      const value = event.results?.[0]?.[0]?.transcript?.trim();
      if (value) addTurn({ clientTurnId: crypto.randomUUID(), role: "user", text: value });
    };
    recognition.onerror = () => setError("这一句没听清，再说一次。" );
    recognition.onend = () => { if (!pausedRef.current && sessionRef.current?.status === "active") window.setTimeout(startRecognition, 250); };
    recognition.start();
  }

  useEffect(() => {
    if (active && isMock && !paused) startRecognition();
    return () => { try { recognitionRef.current?.stop(); } catch {} };
    // The mock recognizer is started once per active session and restarts itself after each utterance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isMock]);

  async function submitText() {
    const value = text.trim();
    if (!value) return;
    setText("");
    addTurn({ clientTurnId: crypto.randomUUID(), role: "user", text: value });
  }

  async function finish() {
    if (!sessionRef.current || finishingRef.current) return;
    finishingRef.current = true;
    setBusy(true); setStatus("正在收好这次陪泡");
    try {
      if (brewState?.status === "active") {
        const event = await authenticated<BrewEventResult>(`/voice/sessions/${sessionRef.current.voiceSessionId}/brew/events`, {
          method: "POST",
          ...jsonBody({ clientEventId: crypto.randomUUID(), eventType: "complete", source: "touch" }),
        });
        applyState(event.brewState);
      }
      try { recognitionRef.current?.stop(); } catch {}
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      setCameraWorking(false);
      await rtcRef.current?.stopCaptureAndDrain();
      rtcRef.current = null;
      await Promise.allSettled([...pendingWritesRef.current]);
      const result = await authenticated<VoiceStop>(`/voice/sessions/${sessionRef.current.voiceSessionId}/stop`, {
        method: "POST", ...jsonBody({ infusionNumber: brewState?.infusionNumber || 1 }),
      });
      const done = { ...sessionRef.current, status: "completed" as const };
      setSession(done); sessionRef.current = done; setCompletion(result); setStatus("会话已完成");
      window.localStorage.removeItem(resumeStorageKey(teaId));
      setResumeSessionId(null);
      await wakeLockRef.current?.release().catch(() => undefined);
    } catch (cause) {
      setError((cause as Error).message || "这一段还没收好，再试一次。");
      finishingRef.current = false;
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (brewState?.status === "completed" && active && !busy && !autoFinishRef.current) {
      autoFinishRef.current = true;
      void finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brewState?.status, active, busy]);

  const currentFeedbackSaved = useMemo(() => brewState?.completedInfusions?.some((item) => item.number === brewState.infusionNumber) || false, [brewState]);
  const nextStage = brewState ? NEXT_STAGE[brewState.currentStage] : undefined;

  if (completion) return (
    <section className="voice-page voice-complete">
      <CheckCircle size={56} weight="duotone" />
      <p className="eyebrow">这一轮已收好</p>
      <h1 className="title">这一轮，记下了。</h1>
      <p className="subtitle">每一泡的时间、反馈和调整都留在了这杯茶里。</p>
      <Link className="button primary block" href={teaStepHref("taste", teaId, origin)}>接着说出这一口 <ArrowRight size={18} /></Link>
      <Link className="voice-secondary-link" href={teaDetailHref(teaId, origin)}>返回茶详情</Link>
    </section>
  );

  return (
    <section className="voice-page brew-companion-page">
      <header className="voice-header"><BackControl href={teaDetailHref(teaId, origin)} ariaLabel="返回茶详情" /><span>Tea-BTI 茶伴</span><span className="voice-mode-icon"><BowlSteam size={21} /></span></header>
      <p className="eyebrow">陪你泡这杯</p>
      <h1 className="title">{tea?.name || "这一杯茶"}</h1>

      {!active ? <div className="brew-setup-card">
        <p>我们先这样泡，第一口喝完我再跟着你调。</p>
        <div className="brew-setup-grid">
          <label><span>器具</span><input value={vessel} onChange={(event) => setVessel(event.target.value)} /></label>
          <label><span>水量</span><input type="number" min={30} max={1000} value={waterVolumeMl} onChange={(event) => setWaterVolumeMl(Number(event.target.value))} /><small>ml</small></label>
          <div><span>水温</span><strong>{tea?.brewingGuide.temperatureRange || "—"}</strong></div>
          <div><span>茶量</span><strong>{tea?.brewingGuide.teaAmount || "—"}</strong></div>
        </div>
        <button className={`camera-choice ${cameraWanted ? "selected" : ""}`} onClick={() => setCameraWanted((value) => !value)}>
          {cameraWanted ? <Camera size={20} /> : <CameraSlash size={20} />}
          <span><strong>{cameraWanted ? "打开画面辅助" : "只用语音陪泡"}</strong><small>画面只帮助判断动作，不保存图片</small></span>
          {cameraWanted ? <Check size={18} /> : null}
        </button>
      </div> : null}

      {active && brewState ? <>
        <div className="brew-live-head">
          <span>第 {brewState.infusionNumber} / {brewState.maxInfusions} 泡</span>
          <strong>{stageLabel(brewState.currentStage, brewState)}</strong>
          <span>{brewState.temperatureC ? `${brewState.temperatureC}°C` : brewState.temperatureRange}</span>
        </div>
        <div className={`brew-camera ${cameraWorking ? "active" : "fallback"}`}>
          {cameraWorking ? <video ref={videoRef} playsInline muted aria-label="茶具摄像头预览" /> : <div><CameraSlash size={28} /><span>语音陪泡中</span></div>}
          <span className="brew-camera-state">{cameraWorking && visionWorking ? "观察中" : "语音确认"}</span>
          <div className="brew-frame-guide" />
        </div>
        {visionPrompt ? <div className="vision-confirm-card">
          <p>{visionPrompt}</p>
          <div><button className="button primary" onClick={() => void confirmVision()}><Check size={18} />对</button><button className="button" onClick={() => void declineVision()}><X size={18} />还没有</button></div>
        </div> : null}
        <div className={`brew-timer ${brewState.currentStage === "steep" ? "running" : ""}`}>
          <Timer size={22} />
          <div><span>{brewState.currentStage === "steep" ? "这一泡还剩" : `这一泡先等 ${brewState.plannedDurationSeconds} 秒`}</span><strong>{brewState.currentStage === "steep" ? formatSeconds(remaining) : `${brewState.plannedDurationSeconds}秒`}</strong></div>
          {brewState.currentStage === "steep" ? <button onClick={() => void sendEvent({ eventType: "timer_adjust", seconds: 5 })}><Plus size={16} />5秒</button> : null}
        </div>
        {brewState.adjustmentMessage ? <p className="brew-adjustment">{brewState.adjustmentMessage}</p> : null}
        <div className="stage-list">{["prepare", "warm_vessel", "add_leaves", "pour", "steep", "decant", "taste"].map((value) => <span key={value} className={`stage ${brewState.currentStage === value ? "active" : ""}`}>{stageLabel(value as BrewState["currentStage"], brewState)}</span>)}</div>
      </> : null}

      <div className="voice-orb-wrap">
        {!active ? <button aria-label={resumeSessionId ? "恢复上次陪泡" : "开始陪泡"} className="voice-orb" disabled={busy || !tea} onClick={() => void (resumeSessionId ? resume() : start())}>{resumeSessionId ? <Play size={40} weight="fill" /> : <Microphone size={40} weight="duotone" />}</button>
          : <button aria-label={paused ? "继续聆听" : "暂停聆听"} className={`voice-orb ${paused ? "paused" : "active"}`} disabled={busy} onClick={() => void toggleCapture()}>{paused ? <Play size={40} weight="fill" /> : <Pause size={40} weight="fill" />}</button>}
        <p>{active ? (paused ? "已暂停，计时仍在继续" : "正在聆听，直接说话") : "点一下，之后尽量不用碰屏幕"}</p>
      </div>
      <p className="status-pill voice-status"><span className="status-dot" />{status}</p>

      {active && brewState?.currentStage === "taste" && !currentFeedbackSaved ? <div className="brew-feedback">
        <p>这一泡喝起来怎么样？</p>
        <div>{FEEDBACKS.map(([value, label]) => <button key={value} disabled={busy} onClick={() => void sendEvent({ eventType: "taste_feedback", feedback: value, userWords: label })}>{label}</button>)}</div>
      </div> : null}

      {active && brewState ? <div className="brew-controls">
        {nextStage ? <button className="button primary block" disabled={busy} onClick={() => void sendEvent({ eventType: "confirm_stage", stage: nextStage })}>{brewState.currentStage === "steep" ? (brewState.vessel.includes("玻璃") ? "现在品饮" : "现在出汤") : `进入${stageLabel(nextStage, brewState)}`} <ArrowRight size={18} /></button> : null}
        {brewState.currentStage === "taste" && currentFeedbackSaved && brewState.infusionNumber < brewState.maxInfusions ? <button className="button primary block" disabled={busy} onClick={() => void sendEvent({ eventType: "next_infusion" })}>开始第 {brewState.infusionNumber + 1} 泡 <ArrowRight size={18} /></button> : null}
        {brewState.currentStage === "taste" && currentFeedbackSaved && brewState.infusionNumber === brewState.maxInfusions ? <button className="button warm block" disabled={busy} onClick={() => void finish()}><StopCircle size={19} />{brewState.isMatcha ? "完成这一碗" : "完成三泡"}</button> : null}
      </div> : null}

      {active ? <div className="voice-composer"><textarea className="text-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="也可以打字告诉茶伴…" /><button className="button" onClick={() => void submitText()}>发送</button></div> : null}
      {turns.length ? <div className="transcript compact-transcript">{turns.slice(-4).map((turn) => <div className={`turn ${turn.role}`} key={turn.clientTurnId}><small>{turn.role === "user" ? "你" : "茶伴"}</small>{turn.text}</div>)}</div> : null}
      {error ? <p className="error">{error}</p> : null}
      {!active && resumeSessionId ? <button disabled={busy || !tea} className="button primary block brew-start" onClick={() => void resume()}><Play size={19} />{busy ? "正在恢复…" : "恢复上次陪泡"}</button> : null}
      {!active && !resumeSessionId ? <button disabled={busy || !tea} className="button primary block brew-start" onClick={() => void start()}><Microphone size={19} />{busy ? "正在连接…" : "开始免手陪泡"}</button> : null}
      {active && rtcFailed ? <button className="button block" disabled={busy} onClick={() => void reconnectRtc()}>重新连接实时语音</button> : null}
      {active ? <button className="voice-secondary-button" disabled={busy} onClick={() => void finish()}>提前结束陪泡</button> : null}
    </section>
  );
}
