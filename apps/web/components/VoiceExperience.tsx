"use client";

import Link from "next/link";
import { ArrowRight, BowlSteam, ChatCircleDots, CheckCircle, Microphone, PaperPlaneTilt, StopCircle, Waveform } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BackControl } from "@/components/BackControl";
import { abortVoiceSessionBestEffort, authenticated, jsonBody } from "@/lib/api";
import type { TeaJourney, VoiceSession, VoiceStop } from "@/lib/api";
import { realmFromTeaHref, teaDetailHref, teaStepHref } from "@/lib/navigation";
import type { TeaOrigin } from "@/lib/navigation";
import { RtcVoiceClient } from "@/lib/rtc";
import type { TranscriptTurn } from "@/lib/rtc";

const STAGES = [
  ["prepare", "准备"], ["warm_vessel", "温杯"], ["add_leaves", "投茶"], ["pour", "注水"],
  ["steep", "浸泡"], ["decant", "出汤"], ["taste", "品饮"], ["complete", "完成"],
] as const;

const BREW_GUIDANCE: Record<string, string> = {
  prepare: "把茶、器具和水放到手边。用量先看包装说明。",
  warm_vessel: "用热水温一温器具，倒净，再等茶叶进来。",
  add_leaves: "茶叶入器，先闻一闻。第一缕香气最轻，也最短。",
  pour: "可以注水了。水温沿用包装建议，慢一点也没关系。",
  steep: "先等短一点。滋味淡了，下一泡再多留几秒。",
  decant: "把茶汤倒净，让这一泡停在刚好的地方。",
  taste: "等它不烫口，喝一小口，说最先浮上来的感觉。",
  complete: "这一泡走完了。把杯里的余味，也带去下一步。",
};

type RecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null;
};

type ApiFailure = Error & { code?: string; details?: { voiceSessionId?: string } };

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
  return { brew: "回到陪泡", taste: "接着说出这一口", realm: "进入《雾里一芽》", passport: "查看茶护照" }[journey.nextStep];
}

export function VoiceExperience({ teaId, mode, origin = "swipe" }: { teaId: string; mode: "brew" | "taste"; origin?: TeaOrigin }) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [status, setStatus] = useState("尚未连接");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [text, setText] = useState("");
  const [stage, setStage] = useState("prepare");
  const [infusionNumber, setInfusionNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [transcriptWarning, setTranscriptWarning] = useState("");
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [completion, setCompletion] = useState<VoiceStop | null>(null);
  const rtcRef = useRef<RtcVoiceClient | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const savedTextRef = useRef("");
  const pendingTurnWritesRef = useRef<Set<Promise<void>>>(new Set());
  const turnPersistenceFailedRef = useRef(false);
  const seenTurnIdsRef = useRef(new Set<string>());
  const active = session?.status === "active";
  const isMock = session?.providerMode === "browser_mock";
  const title = mode === "brew" ? "陪你泡这杯" : "陪你说出这一口";
  const description = mode === "brew" ? "你报一步，我陪一步。水温和用量，以包装说明为准。" : "先说第一感觉，茶语稍后再慢慢认。";

  const mockReply = useMemo(() => {
    if (mode === "taste") return "这句话我先收好。结束时，再替它找到几枚茶语。";
    return BREW_GUIDANCE[stage];
  }, [mode, stage]);

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
      return await authenticated<VoiceSession>("/voice/sessions", { method: "POST", ...jsonBody({ mode, teaId }) });
    } catch (cause) {
      const error = cause as ApiFailure;
      const existingId = error.code === "VOICE_SESSION_ACTIVE" ? error.details?.voiceSessionId : undefined;
      if (!existingId) throw cause;
      await authenticated(`/voice/sessions/${existingId}/abort`, { method: "POST", ...jsonBody({}) });
      return authenticated<VoiceSession>("/voice/sessions", { method: "POST", ...jsonBody({ mode, teaId }) });
    }
  }

  async function connectRealSession(target: VoiceSession) {
    const rtc = new RtcVoiceClient();
    rtcRef.current = rtc;
    await rtc.connect(
      target,
      addTurn,
      (message, state) => {
        setStatus(message);
        if (state === "connected" || state === "listening" || state === "thinking" || state === "speaking") {
          setConnectionIssue(false);
        }
      },
      (message) => {
        setConnectionIssue(true);
        setError(message);
      },
    );
  }

  async function start() {
    setBusy(true); setError("");
    let prepared: VoiceSession | null = null;
    try {
      turnPersistenceFailedRef.current = false;
      savedTextRef.current = "";
      seenTurnIdsRef.current.clear();
      setConnectionIssue(false);
      setTranscriptWarning("");
      prepared = await createPreparedSession();
      setSession(prepared);
      sessionRef.current = prepared;
      if (prepared.providerMode === "volcengine_rtc") {
        await connectRealSession(prepared);
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          setStatus("演示模式已就绪");
        } catch { setStatus("演示模式 · 可使用文字输入"); }
      }
      const started = await authenticated<VoiceSession>(`/voice/sessions/${prepared.voiceSessionId}/start`, { method: "POST" });
      setSession(started); sessionRef.current = started; setStatus(started.providerMode === "browser_mock" ? "演示模式 · 正在陪伴" : "实时语音已连接");
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
      setError(startErrorMessage(cause)); setStatus("连接失败");
    }
    finally { setBusy(false); }
  }

  async function reconnect() {
    if (!session || session.providerMode !== "volcengine_rtc") return;
    setBusy(true); setError("");
    try {
      await rtcRef.current?.disconnect();
      rtcRef.current = null;
      const refreshed = await authenticated<VoiceSession>(`/voice/sessions/${session.voiceSessionId}/start`, { method: "POST" });
      await connectRealSession(refreshed);
      setSession(refreshed); sessionRef.current = refreshed;
      setConnectionIssue(false); setStatus("正在聆听，直接说话");
    } catch (cause) {
      setConnectionIssue(true);
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

  async function changeStage(next: string) {
    if (!session) return;
    try {
      await authenticated(`/voice/sessions/${session.voiceSessionId}/context`, { method: "PATCH", ...jsonBody({ brewStage: next, infusionNumber }) });
      setStage(next);
      if (isMock) {
        speak(BREW_GUIDANCE[next]);
      }
    } catch { setError("这一步还没记下，再点一次。"); }
  }

  async function stop() {
    if (!session) return; setBusy(true);
    try {
      try { recognitionRef.current?.stop(); } catch {}
      await rtcRef.current?.stopCaptureAndDrain();
      rtcRef.current = null;
      await flushPendingTurns();
      if (turnPersistenceFailedRef.current) setTranscriptWarning("会话已保存，但有少量实时字幕未能写入短期记录。");
      const result = await authenticated<VoiceStop>(`/voice/sessions/${session.voiceSessionId}/stop`, {
        method: "POST", ...jsonBody({ saveUserText: mode === "taste" ? savedTextRef.current || undefined : undefined, infusionNumber }),
      });
      const completed = { ...session, status: "completed" as const };
      setCompletion(result); setSession(completed); sessionRef.current = completed; setStatus("会话已完成");
    } catch (cause) {
      const error = cause as ApiFailure;
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
    setStage("prepare");
    setInfusionNumber(1);
    setConnectionIssue(false);
    seenTurnIdsRef.current.clear();
    setStatus("尚未连接");
    setError("");
  }

  if (session?.status === "completed" && completion) return (
    <section className="voice-page voice-complete">
      <CheckCircle size={56} weight="duotone" />
      <p className="eyebrow">{completion.experienceCompleted ? "已经收好" : "先停在这里"}</p>
      <h1 className="title">{completion.experienceCompleted ? (mode === "brew" ? "这一泡，记下了。" : "这句话，收好了。") : (mode === "brew" ? "还差最后一步。" : "还想听你说一句。")}</h1>
      {completion.tasteResult ? <><p>你说：“{completion.tasteResult.userWords}”</p><div className="tags light-tags">{completion.tasteResult.normalizedTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><p className="subtitle">{completion.tasteResult.explanation}</p></> : null}
      {transcriptWarning ? <p className="error">{transcriptWarning}</p> : null}
      {completion.experienceCompleted ? <Link className="button primary block" href={journeyHref(completion.journey, origin)}>{journeyLabel(completion.journey)} <ArrowRight size={18} /></Link> : <button className="button primary block" onClick={resetExperience}>{mode === "brew" ? "继续陪泡" : "补充一句感受"} <ArrowRight size={18} /></button>}
      <Link className="voice-secondary-link" href={teaDetailHref(teaId, origin)}>返回茶详情</Link>
    </section>
  );

  return (
    <section className="voice-page">
      <header className="voice-header"><BackControl href={teaDetailHref(teaId, origin)} ariaLabel="返回茶详情" /><span>Tea-BTI 茶伴</span><span className="voice-mode-icon">{mode === "brew" ? <BowlSteam size={21} /> : <ChatCircleDots size={21} />}</span></header>
      <p className="eyebrow">茶伴 · {session ? (isMock ? "演示模式" : "实时语音") : "等你开口"}</p><h1 className="title">{title}</h1><p className="subtitle">{description}</p>
      {mode === "brew" && active ? <div className="stage-list">{STAGES.map(([value, label]) => <button disabled={busy || connectionIssue} key={value} className={`stage ${stage === value ? "active" : ""}`} onClick={() => void changeStage(value)}>{label}</button>)}</div> : null}
      {active ? <div className="stage-list" aria-label="当前泡数"><button disabled={busy || infusionNumber <= 1} onClick={() => setInfusionNumber((value) => Math.max(1, value - 1))}>上一泡</button><span className="status-pill">第 {infusionNumber} 泡</span><button disabled={busy || infusionNumber >= 20} onClick={() => setInfusionNumber((value) => Math.min(20, value + 1))}>下一泡</button></div> : null}
      <div className="voice-orb-wrap">
        {!session || isMock ? <button aria-label="语音状态" className={`voice-orb ${active ? "active" : ""}`} disabled={!active} onClick={startRecognition}>{listening ? <Waveform size={40} weight="bold" /> : <Microphone size={40} weight="duotone" />}</button> : <div role="status" aria-label="实时语音状态" className={`voice-orb ${active ? "active" : ""}`}><Microphone size={40} weight="duotone" /></div>}
        <p>{active ? (isMock ? (listening ? "正在听" : "轻触，说出这一口") : "正在聆听，直接说话") : "连上以后，在这里开口"}</p>
      </div>
      <p className="status-pill voice-status"><span className="status-dot" />{status}</p>
      <div className="transcript">{turns.length ? turns.map((turn) => <div className={`turn ${turn.role}`} key={turn.clientTurnId}><small>{turn.role === "user" ? "你" : "Tea-BTI 茶伴"}</small>{turn.text}</div>) : <p className="empty">你说的话，会落在这里</p>}</div>
      {active ? <div className="voice-composer"><textarea disabled={connectionIssue} className="text-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="也可以写下这一口…" /><button className="button" aria-label="发送文字" disabled={busy || connectionIssue} onClick={() => void submitText()}><PaperPlaneTilt size={20} weight="fill" /></button></div> : null}
      {error ? <p className="error">{error}</p> : null}
      {active && !isMock && connectionIssue ? <button className="button block" disabled={busy} onClick={() => void reconnect()}>重新连接实时语音</button> : null}
      <div className="voice-primary-action">{!active ? <button disabled={busy} className="button primary block" onClick={() => void start()}><Microphone size={19} />打开麦克风</button> : <button disabled={busy} className="button warm block" onClick={() => void stop()}><StopCircle size={19} />{mode === "brew" ? (stage === "complete" ? "结束并记下这一泡" : "先停在这里") : "结束并保存"}</button>}</div>
      {mode === "brew" && active && stage !== "complete" ? <p className="voice-save-hint">走到“完成”，这次泡茶才会记进护照。</p> : null}
    </section>
  );
}
