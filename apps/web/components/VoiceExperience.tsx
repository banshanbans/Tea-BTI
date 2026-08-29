"use client";

import Link from "next/link";
import { ArrowRight, ChatCircleDots, CheckCircle, Microphone, PaperPlaneTilt, Pause, Play, StopCircle, Waveform } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { BackControl } from "@/components/BackControl";
import { abortVoiceSessionBestEffort, authenticated, jsonBody } from "@/lib/api";
import type { TeaJourney, VoiceSession, VoiceStop } from "@/lib/api";
import { realmFromTeaHref, teaDetailHref, teaStepHref } from "@/lib/navigation";
import type { TeaOrigin } from "@/lib/navigation";
import { RtcVoiceClient } from "@/lib/rtc";
import type { TranscriptTurn } from "@/lib/rtc";
import { tasteTagLabel } from "@/lib/taste-language";
import { BrewCompanionExperience } from "@/components/BrewCompanionExperience";

type RecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null;
};

type ApiFailure = Error & { code?: string; details?: { voiceSessionId?: string } };
type VoiceUiPhase = "idle" | "requesting_permission" | "preparing" | "joining" | "listening" | "paused" | "reconnecting" | "finishing" | "error" | "complete";

function startErrorMessage(cause: unknown): string {
  const error = cause as ApiFailure;
  if (error.code === "VOICE_PROVIDER_UNAVAILABLE") return "实时茶伴暂时不可用，请稍后重试。";
  if (error.code === "VOICE_START_UNCERTAIN") return "实时茶伴的启动结果尚未确认，正在安全结束这次连接，请稍后重试。";
  if (error.code === "VOICE_ABORT_FAILED") return "上一段实时语音尚未结束，请稍后重试。";
  if (error.code === "VOICE_SESSION_BUSY") return "茶伴正在处理上一项操作，请稍后重试。";
  if (error.code === "VOICE_STOP_FAILED") return "上一段实时语音还在结束，请再试一次。";
  if (error.code === "VOICE_SESSION_ACTIVE") return "上一段陪伴还在进行，请先结束后再试。";
  if (error.code === "TEA_NOT_FOUND") return "这杯茶的陪伴资料暂时不完整。";
  if (error.message.includes("麦克风") || error.message.includes("RTC") || error.message.includes("浏览器") || error.message.includes("permission") || error.message.includes("权限")) {
    return "麦克风没有接上。检查浏览器权限后再试。";
  }
  return error.message || "茶伴还没连上，请稍后重试。";
}

function journeyHref(journey: TeaJourney, origin: TeaOrigin): string {
  if (journey.nextStep === "brew") return teaStepHref("brew", journey.teaId, origin);
  if (journey.nextStep === "taste") return teaStepHref("taste", journey.teaId, origin);
  if (journey.nextStep === "realm" && journey.realmId) return realmFromTeaHref(journey.realmId, journey.teaId, origin);
  return "/passport";
}

function journeyLabel(journey: TeaJourney): string {
  return { brew: "回到陪泡", taste: "接着说出这一口", realm: "带着这一口进入《雾里一芽》", passport: "查看茶护照" }[journey.nextStep];
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function VoiceExperience({ teaId, mode, origin = "swipe" }: { teaId: string; mode: "brew" | "taste"; origin?: TeaOrigin }) {
  if (mode === "brew") return <BrewCompanionExperience teaId={teaId} origin={origin} />;
  return <TasteVoiceExperience teaId={teaId} origin={origin} />;
}

function TasteVoiceExperience({ teaId, origin = "swipe" }: { teaId: string; origin?: TeaOrigin }) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [status, setStatus] = useState("尚未连接");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [text, setText] = useState("");
  const [infusionNumber, setInfusionNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoiceUiPhase>("idle");
  const [error, setError] = useState("");
  const [transcriptWarning, setTranscriptWarning] = useState("");
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [completion, setCompletion] = useState<VoiceStop | null>(null);
  const rtcRef = useRef<RtcVoiceClient | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const pausedRef = useRef(false);
  const savedTextRef = useRef("");
  const pendingTurnWritesRef = useRef<Set<Promise<void>>>(new Set());
  const turnPersistenceFailedRef = useRef(false);
  const seenTurnIdsRef = useRef(new Set<string>());
  const active = session?.status === "active";
  const isMock = session?.providerMode === "browser_mock";
  const title = "陪你说出这一口";
  const description = "先说第一感觉，茶语稍后再慢慢认。";
  const mockReply = "这句话我先收好。结束时，再替它找到几枚茶语。";

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch {}
    void rtcRef.current?.disconnect().catch(() => undefined);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    const current = sessionRef.current;
    if (current && ["prepared", "starting", "active", "stopping", "failed"].includes(current.status)) {
      abortVoiceSessionBestEffort(current.voiceSessionId);
    }
  }, []);

  function speak(value: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(value);
      utterance.lang = "zh-CN"; utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Voice playback is an enhancement; the text companion remains usable without it.
    }
  }

  async function persistTurn(turn: TranscriptTurn) {
    const current = sessionRef.current;
    if (!current) return;
    await authenticated(`/voice/sessions/${current.voiceSessionId}/turns`, { method: "POST", ...jsonBody({ turns: [turn] }) });
  }

  function queueTurnPersistence(turn: TranscriptTurn) {
    let request: Promise<void>;
    request = persistTurn(turn)
      .catch(() => persistTurn(turn))
      .catch(() => { turnPersistenceFailedRef.current = true; })
      .finally(() => pendingTurnWritesRef.current.delete(request));
    pendingTurnWritesRef.current.add(request);
  }

  async function flushPendingTurns() {
    await Promise.allSettled([...pendingTurnWritesRef.current]);
  }

  function addTurn(turn: TranscriptTurn) {
    if (seenTurnIdsRef.current.has(turn.clientTurnId)) return;
    seenTurnIdsRef.current.add(turn.clientTurnId);
    setTurns((current) => [...current, turn]);
    if (turn.role === "user") {
      savedTextRef.current = [savedTextRef.current, turn.text].filter(Boolean).join("。").slice(0, 500);
    }
    queueTurnPersistence(turn);
  }

  async function createPreparedSession(): Promise<VoiceSession> {
    try {
      return await authenticated<VoiceSession>("/voice/sessions", { method: "POST", ...jsonBody({ mode: "taste", teaId }) });
    } catch (cause) {
      const error = cause as ApiFailure;
      const existingId = error.code === "VOICE_SESSION_ACTIVE" ? error.details?.voiceSessionId : undefined;
      if (!existingId) throw cause;
      await authenticated(`/voice/sessions/${existingId}/abort`, { method: "POST", ...jsonBody({}) });
      return authenticated<VoiceSession>("/voice/sessions", { method: "POST", ...jsonBody({ mode: "taste", teaId }) });
    }
  }

  async function connectRealSession(target: VoiceSession) {
    const rtc = new RtcVoiceClient();
    rtcRef.current = rtc;
    await rtc.connect(
      target,
      addTurn,
      (message, state) => {
        if (state === "connected" || state === "listening" || state === "thinking" || state === "speaking") {
          setConnectionIssue(false);
          if (pausedRef.current) {
            setStatus("已暂停");
            return;
          }
          setVoicePhase("listening");
        } else if (state === "checking" || state === "joining") {
          setVoicePhase("joining");
        } else if (state === "reconnecting" || state === "lost") {
          setVoicePhase("reconnecting");
        }
        setStatus(message);
      },
      (message) => {
        setConnectionIssue(true);
        setVoicePhase("error");
        setError(message);
      },
    );
    return rtc;
  }

  async function requestMicrophonePermission(): Promise<boolean> {
    setVoicePhase("requesting_permission");
    setStatus("正在申请麦克风权限");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("当前浏览器不支持麦克风");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async function runStart(permissionGranted: boolean) {
    let prepared: VoiceSession | null = null;
    try {
      setVoicePhase("preparing");
      setStatus("正在准备茶伴");
      turnPersistenceFailedRef.current = false;
      savedTextRef.current = "";
      seenTurnIdsRef.current.clear();
      setConnectionIssue(false);
      setTranscriptWarning("");
      prepared = await createPreparedSession();
      setSession(prepared);
      sessionRef.current = prepared;
      if (prepared.providerMode === "volcengine_rtc") {
        if (!permissionGranted) throw new Error("没有麦克风权限");
        await connectRealSession(prepared);
      } else {
        setStatus(permissionGranted ? "演示模式已就绪" : "演示模式 · 可使用文字输入");
      }
      const started = await authenticated<VoiceSession>(`/voice/sessions/${prepared.voiceSessionId}/start`, { method: "POST" });
      pausedRef.current = false;
      setPaused(false);
      setVoicePhase("listening");
      setSession(started); sessionRef.current = started;
      setStatus(started.providerMode === "browser_mock" ? (permissionGranted ? "正在陪伴" : "可使用文字输入") : "实时语音已连接");
      if (started.providerMode === "browser_mock") speak(started.welcomeMessage);
    } catch (cause) {
      await rtcRef.current?.disconnect().catch(() => undefined);
      rtcRef.current = null;
      let cleanupFailed = false;
      if (prepared) {
        await authenticated(`/voice/sessions/${prepared.voiceSessionId}/abort`, { method: "POST", ...jsonBody({}) }).catch(() => { cleanupFailed = true; });
      }
      if (cleanupFailed && prepared) {
        const pending = { ...prepared, status: "starting" as const };
        setSession(pending); sessionRef.current = pending;
      } else {
        setSession(null); sessionRef.current = null;
      }
      setVoicePhase("error");
      setError(startErrorMessage(cause)); setStatus("连接失败");
    }
  }

  function startFromUserGesture() {
    if (startPromiseRef.current) return;
    setBusy(true);
    setError("");
    const pending = requestMicrophonePermission()
      .then((permissionGranted) => runStart(permissionGranted))
      .finally(() => {
        startPromiseRef.current = null;
        setBusy(false);
      });
    startPromiseRef.current = pending;
  }

  async function reconnect() {
    if (!session || session.providerMode !== "volcengine_rtc") return;
    const shouldRemainPaused = pausedRef.current;
    setBusy(true); setError(""); setVoicePhase("reconnecting");
    try {
      await rtcRef.current?.disconnect();
      rtcRef.current = null;
      const refreshed = await authenticated<VoiceSession>(`/voice/sessions/${session.voiceSessionId}/start`, { method: "POST" });
      const reconnectedRtc = await connectRealSession(refreshed);
      if (shouldRemainPaused) await reconnectedRtc.pauseCapture();
      setSession(refreshed); sessionRef.current = refreshed;
      setConnectionIssue(false);
      setVoicePhase(shouldRemainPaused ? "paused" : "listening");
      setStatus(shouldRemainPaused ? "已暂停" : "正在聆听，直接说话");
    } catch (cause) {
      setConnectionIssue(true);
      setVoicePhase("error");
      setError(startErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function startRecognition() {
    const scope = window as typeof window & { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) { setError("这台浏览器听不见你，可以直接打字。"); return; }
    const recognition = new Constructor(); recognitionRef.current = recognition;
    recognition.lang = "zh-CN"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => {
      const value = event.results?.[0]?.[0]?.transcript?.trim();
      if (value) { const turn = { clientTurnId: crypto.randomUUID(), role: "user" as const, text: value }; addTurn(turn); const reply = { clientTurnId: crypto.randomUUID(), role: "assistant" as const, text: mockReply }; addTurn(reply); speak(mockReply); }
    };
    recognition.onerror = () => setError("这一句没听清，再说一次，或直接打字。");
    recognition.onend = () => setListening(false);
    setListening(true); recognition.start();
  }

  async function toggleCapture() {
    if (!active || busy || connectionIssue) return;
    setBusy(true);
    setError("");
    try {
      if (isMock) {
        if (listening) {
          pausedRef.current = true;
          setPaused(true);
          setVoicePhase("paused");
          setStatus("已暂停");
          try { recognitionRef.current?.stop(); } catch {}
        } else {
          pausedRef.current = false;
          setPaused(false);
          setVoicePhase("listening");
          setStatus("正在听");
          startRecognition();
        }
      } else if (pausedRef.current) {
        await rtcRef.current?.resumeCapture();
        pausedRef.current = false;
        setPaused(false);
        setVoicePhase("listening");
        setStatus("正在聆听，直接说话");
      } else {
        await rtcRef.current?.pauseCapture();
        pausedRef.current = true;
        setPaused(true);
        setVoicePhase("paused");
        setStatus("已暂停");
      }
    } catch {
      setVoicePhase("error");
      setError("麦克风还没切换成功，请再试一次。");
    } finally {
      setBusy(false);
    }
  }

  async function submitText() {
    const value = text.trim(); if (!value) return;
    addTurn({ clientTurnId: crypto.randomUUID(), role: "user", text: value }); setText("");
    if (isMock) {
      const reply = { clientTurnId: crypto.randomUUID(), role: "assistant" as const, text: mockReply };
      addTurn(reply); speak(mockReply);
      return;
    }
    if (!session) return;
    setBusy(true);
    try {
      await authenticated(`/voice/sessions/${session.voiceSessionId}/context`, {
        method: "PATCH",
        ...jsonBody({ userText: value }),
      });
    } catch (cause) {
      const error = cause as ApiFailure;
      setError(error.code === "VOICE_CONTEXT_UPDATE_FAILED" ? "这句文字还没有送到茶伴，请再发一次。" : "这句话还没发出去。");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!session) return;
    setBusy(true);
    setVoicePhase("finishing");
    setStatus("正在收好最后一句…");
    try {
      try { recognitionRef.current?.stop(); } catch {}
      await rtcRef.current?.stopCaptureAndDrain();
      rtcRef.current = null;
      pausedRef.current = false;
      setPaused(false);
      await flushPendingTurns();
      if (turnPersistenceFailedRef.current) setTranscriptWarning("会话已保存，但有少量实时字幕未能写入短期记录。");
      const stopRequest = () => authenticated<VoiceStop>(`/voice/sessions/${session.voiceSessionId}/stop`, {
        method: "POST", ...jsonBody({ saveUserText: savedTextRef.current || undefined, infusionNumber }),
      });
      let result: VoiceStop;
      try {
        result = await stopRequest();
      } catch (cause) {
        const error = cause as ApiFailure;
        if (!["VOICE_STOP_FAILED", "VOICE_SESSION_BUSY"].includes(error.code || "")) throw cause;
        setStatus("正在确认这一口已经收好…");
        await wait(450);
        result = await stopRequest();
      }
      const completed = { ...session, status: "completed" as const };
      setCompletion(result); setSession(completed); sessionRef.current = completed; setStatus("会话已完成"); setVoicePhase("complete");
    } catch (cause) {
      const error = cause as ApiFailure;
      setVoicePhase("error");
      setStatus("结束尚未完成");
      setError(
        error.code === "VOICE_STOP_FAILED" ? "实时语音还在结束，请再点一次。"
          : error.code === "TASTE_PROVIDER_UNAVAILABLE" ? "茶语整理服务暂时不可用，再点一次即可继续保存。"
            : "这一段还没收好，再试一次。",
      );
    }
    finally { setBusy(false); }
  }

  function resetExperience() {
    setSession(null);
    sessionRef.current = null;
    setCompletion(null);
    setTurns([]);
    setText("");
    savedTextRef.current = "";
    turnPersistenceFailedRef.current = false;
    setTranscriptWarning("");
    setInfusionNumber(1);
    pausedRef.current = false;
    setPaused(false);
    setVoicePhase("idle");
    setConnectionIssue(false);
    seenTurnIdsRef.current.clear();
    setStatus("尚未连接");
    setError("");
  }

  if (session?.status === "completed" && completion) return (
    <section className="voice-page voice-complete">
      <CheckCircle size={56} weight="duotone" />
      <p className="eyebrow">{completion.experienceCompleted ? "已经收好" : "本次已结束"}</p>
      <h1 className="title">{completion.experienceCompleted ? "这一口，记下了。" : "还想听你说一句。"}</h1>
      {completion.tasteResult ? <><p>你说：“{completion.tasteResult.userWords}”</p><div className="tags light-tags">{completion.tasteResult.normalizedTags.map((tag) => <span className="tag" key={tag}>{tasteTagLabel(tag)}</span>)}</div><p className="subtitle">{completion.tasteResult.explanation}</p></> : null}
      {transcriptWarning ? <p className="error">{transcriptWarning}</p> : null}
      {completion.experienceCompleted ? <Link className="button primary block" href={journeyHref(completion.journey, origin)}>{journeyLabel(completion.journey)} <ArrowRight size={18} /></Link> : <button className="button primary block" onClick={resetExperience}>补充一句感受 <ArrowRight size={18} /></button>}
      <Link className="voice-secondary-link" href={teaDetailHref(teaId, origin)}>返回茶详情</Link>
    </section>
  );

  return (
    <section className="voice-page" data-phase={voicePhase}>
      <header className="voice-header"><BackControl href={teaDetailHref(teaId, origin)} ariaLabel="返回茶详情" /><span>Tea-BTI 茶伴</span><span className="voice-mode-icon"><ChatCircleDots size={21} /></span></header>
      <p className="eyebrow">茶伴</p><h1 className="title">{title}</h1>{description ? <p className="subtitle">{description}</p> : null}
      {session ? <p className={`voice-mode-badge ${isMock ? "mock" : "real"}`}>{isMock ? "演示模式" : "实时语音"}</p> : null}
      {active ? <div className="stage-list" aria-label="当前泡数"><button disabled={busy || infusionNumber <= 1} onClick={() => setInfusionNumber((value) => Math.max(1, value - 1))}>上一泡</button><span className="status-pill">第 {infusionNumber} 泡</span><button disabled={busy || infusionNumber >= 20} onClick={() => setInfusionNumber((value) => Math.min(20, value + 1))}>下一泡</button></div> : null}
      <div className="voice-orb-wrap">
        {!active ? <button aria-label="点击中央麦克风打开" className="voice-orb" disabled={busy} onClick={startFromUserGesture}><Microphone size={40} weight="duotone" /></button> : <button aria-label={paused ? "继续聆听" : isMock && !listening ? "开始说话" : "暂停聆听"} className={`voice-orb ${paused ? "paused" : "active"}`} disabled={busy || connectionIssue} onClick={() => void toggleCapture()}>{paused ? <Play size={40} weight="fill" /> : isMock && listening ? <Waveform size={40} weight="bold" /> : isMock ? <Microphone size={40} weight="duotone" /> : <Pause size={40} weight="fill" />}</button>}
        {active ? <p>{paused ? "已暂停，点击继续" : isMock ? (listening ? "正在听" : "轻触，说出这一口") : "正在聆听，直接说话"}</p> : null}
      </div>
      <p className="status-pill voice-status"><span className="status-dot" />{status}</p>
      <div className="transcript">{turns.length ? turns.map((turn) => <div className={`turn ${turn.role}`} key={turn.clientTurnId}><small>{turn.role === "user" ? "你" : "Tea-BTI 茶伴"}</small>{turn.text}</div>) : <p className="empty">你说的话，会落在这里</p>}</div>
      {active ? <div className="voice-composer"><textarea disabled={connectionIssue} className="text-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="也可以写下这一口…" /><button className="button" aria-label="发送文字" disabled={busy || connectionIssue} onClick={() => void submitText()}><PaperPlaneTilt size={20} weight="fill" /></button></div> : null}
      {error ? <p className="error">{error}</p> : null}
      {active && !isMock && connectionIssue ? <button className="button block" disabled={busy} onClick={() => void reconnect()}>重新连接实时语音</button> : null}
      <div className="voice-primary-action">{!active ? <button disabled={busy} className="button primary block" onClick={startFromUserGesture}><Microphone size={19} />{voicePhase === "requesting_permission" ? "正在申请权限…" : "打开麦克风"}</button> : <button disabled={busy} className="button warm block" onClick={() => void stop()}><StopCircle size={19} />{voicePhase === "finishing" ? "正在收好这一口…" : "完成品茶"}</button>}</div>
    </section>
  );
}
