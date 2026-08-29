"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BowlSteam, ChatCircleDots, CheckCircle, Microphone, PaperPlaneTilt, StopCircle, Waveform } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";

import { authenticated, jsonBody } from "@/lib/api";
import type { TeaJourney, VoiceSession, VoiceStop } from "@/lib/api";
import { RtcVoiceClient } from "@/lib/rtc";
import type { TranscriptTurn } from "@/lib/rtc";

const STAGES = [
  ["prepare", "准备"], ["warm_vessel", "温杯"], ["add_leaves", "投茶"], ["pour", "注水"],
  ["steep", "浸泡"], ["decant", "出汤"], ["taste", "品饮"], ["complete", "完成"],
] as const;

type RecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null;
};

function journeyHref(journey: TeaJourney): string {
  if (journey.nextStep === "brew") return `/brew/${journey.teaId}`;
  if (journey.nextStep === "taste") return `/taste/${journey.teaId}`;
  if (journey.nextStep === "realm" && journey.realmId) return `/realm/${journey.realmId}`;
  return "/passport";
}

function journeyLabel(journey: TeaJourney): string {
  return { brew: "回到陪泡", taste: "接着说出这一口", realm: "进入《雾里一芽》", passport: "查看茶护照" }[journey.nextStep];
}

export function VoiceExperience({ teaId, mode }: { teaId: string; mode: "brew" | "taste" }) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [status, setStatus] = useState("尚未连接");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [stage, setStage] = useState("prepare");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [completion, setCompletion] = useState<VoiceStop | null>(null);
  const rtcRef = useRef<RtcVoiceClient | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const active = session?.status === "active";
  const isMock = session?.providerMode === "browser_mock";
  const title = mode === "brew" ? "陪你泡这杯" : "陪你说出这一口";
  const description = mode === "brew" ? "我看不见茶席，会根据你确认的步骤和口述来提醒。" : "先用自己的话说，茶语可以晚一点再认识。";

  const mockReply = useMemo(() => {
    if (mode === "taste") return "我先记住你的原话。结束后，我会把它翻译成更接近茶的语言。";
    const labels: Record<string, string> = { prepare: "先把茶、器具和水准备在手边。具体用量优先看包装说明。", warm_vessel: "可以先温一下器具，倒掉热水后再投茶。", add_leaves: "投茶以后先闻一闻干茶，不需要急着找到标准答案。", pour: "准备注水。我们无法判断精确水温，按包装建议或你已有的水温设置来。", steep: "先从短时间开始，觉得淡再逐泡延长。", decant: "可以出汤了，尽量倒干净，避免这一泡继续变浓。", taste: "等不烫口时喝一小口，先说最直接的感觉。", complete: "这杯泡完了，记得把真实感受留在茶护照里。" };
    return labels[stage];
  }, [mode, stage]);

  function speak(value: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "zh-CN"; utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function persistTurn(turn: TranscriptTurn) {
    const current = sessionRef.current;
    if (!current) return;
    await authenticated(`/voice/sessions/${current.voiceSessionId}/turns`, { method: "POST", ...jsonBody({ turns: [turn] }) });
  }

  function addTurn(turn: TranscriptTurn) {
    setTurns((current) => [...current, turn]);
    if (turn.role === "user") setSavedText(turn.text);
    void persistTurn(turn).catch(() => undefined);
  }

  async function start() {
    setBusy(true); setError("");
    try {
      const prepared = await authenticated<VoiceSession>("/voice/sessions", { method: "POST", ...jsonBody({ mode, teaId }) });
      setSession(prepared);
      sessionRef.current = prepared;
      if (prepared.providerMode === "volcengine_rtc") {
        const rtc = new RtcVoiceClient(); rtcRef.current = rtc;
        await rtc.connect(prepared, addTurn, setStatus);
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          setStatus("演示模式已就绪");
        } catch { setStatus("演示模式 · 可使用文字输入"); }
      }
      const started = await authenticated<VoiceSession>(`/voice/sessions/${prepared.voiceSessionId}/start`, { method: "POST" });
      if (prepared.providerMode === "volcengine_rtc" && started.providerMode === "browser_mock") {
        await rtcRef.current?.disconnect();
        rtcRef.current = null;
      }
      setSession(started); sessionRef.current = started; setStatus(started.providerMode === "browser_mock" ? "演示模式 · 正在陪伴" : "实时语音已连接");
      if (started.providerMode === "browser_mock") speak(started.welcomeMessage);
    } catch (cause) { setError((cause as Error).message); setStatus("连接失败"); }
    finally { setBusy(false); }
  }

  function startRecognition() {
    const scope = window as typeof window & { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) { setError("当前浏览器没有语音转写能力，请直接输入文字。完整实时语音需要配置火山凭据。"); return; }
    const recognition = new Constructor(); recognitionRef.current = recognition;
    recognition.lang = "zh-CN"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => {
      const value = event.results?.[0]?.[0]?.transcript?.trim();
      if (value) { const turn = { clientTurnId: crypto.randomUUID(), role: "user" as const, text: value }; addTurn(turn); const reply = { clientTurnId: crypto.randomUUID(), role: "assistant" as const, text: mockReply }; addTurn(reply); speak(mockReply); }
    };
    recognition.onerror = () => setError("没有听清，可以再说一次或改用文字输入。");
    recognition.onend = () => setListening(false);
    setListening(true); recognition.start();
  }

  function submitText() {
    const value = text.trim(); if (!value) return;
    addTurn({ clientTurnId: crypto.randomUUID(), role: "user", text: value }); setText("");
    if (isMock) { const reply = { clientTurnId: crypto.randomUUID(), role: "assistant" as const, text: mockReply }; addTurn(reply); speak(mockReply); }
  }

  async function changeStage(next: string) {
    if (!session) return; setStage(next);
    try {
      await authenticated(`/voice/sessions/${session.voiceSessionId}/context`, { method: "PATCH", ...jsonBody({ brewStage: next, infusionNumber: 1 }) });
      if (isMock) {
        const labels: Record<string, string> = { prepare: "先把茶、器具和水准备在手边。具体用量优先看包装说明。", warm_vessel: "可以先温一下器具，倒掉热水后再投茶。", add_leaves: "投茶以后先闻一闻干茶，不需要急着找到标准答案。", pour: "准备注水。我们无法判断精确水温，按包装建议或你已有的水温设置来。", steep: "先从短时间开始，觉得淡再逐泡延长。", decant: "可以出汤了，尽量倒干净，避免这一泡继续变浓。", taste: "等不烫口时喝一小口，先说最直接的感觉。", complete: "这杯泡完了，记得把真实感受留在茶护照里。" };
        speak(labels[next]);
      }
    } catch (cause) { setError((cause as Error).message); }
  }

  async function stop() {
    if (!session) return; setBusy(true);
    try {
      recognitionRef.current?.stop(); await rtcRef.current?.disconnect();
      const result = await authenticated<VoiceStop>(`/voice/sessions/${session.voiceSessionId}/stop`, {
        method: "POST", ...jsonBody({ saveUserText: mode === "taste" ? savedText || undefined : undefined, infusionNumber: mode === "taste" ? 1 : undefined }),
      });
      const completed = { ...session, status: "completed" as const };
      setCompletion(result); setSession(completed); sessionRef.current = completed; setStatus("会话已完成");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  function resetExperience() {
    setSession(null);
    sessionRef.current = null;
    setCompletion(null);
    setTurns([]);
    setText("");
    setSavedText("");
    setStage("prepare");
    setStatus("尚未连接");
    setError("");
  }

  if (session?.status === "completed" && completion) return (
    <section className="voice-page voice-complete">
      <CheckCircle size={56} weight="duotone" />
      <p className="eyebrow">{completion.experienceCompleted ? "这次已经记下" : "这次先停在这里"}</p>
      <h1 className="title">{completion.experienceCompleted ? (mode === "brew" ? "这杯，已经泡出来了。" : "你的话，已经变成茶语。") : (mode === "brew" ? "还没有标记为已泡过。" : "还没有留下品饮原话。")}</h1>
      {completion.tasteResult ? <><p>你说：“{completion.tasteResult.userWords}”</p><div className="tags light-tags">{completion.tasteResult.normalizedTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><p className="subtitle">{completion.tasteResult.explanation}</p></> : null}
      {completion.experienceCompleted ? <Link className="button primary block" href={journeyHref(completion.journey)}>{journeyLabel(completion.journey)} <ArrowRight size={18} /></Link> : <button className="button primary block" onClick={resetExperience}>{mode === "brew" ? "继续陪泡" : "补充一句感受"} <ArrowRight size={18} /></button>}
      <Link className="voice-secondary-link" href={`/tea/${teaId}`}>返回茶详情</Link>
    </section>
  );

  return (
    <section className="voice-page">
      <header className="voice-header"><Link href={`/tea/${teaId}`} aria-label="返回茶详情"><ArrowLeft size={21} /></Link><span>Tea-BTI 茶伴</span><span className="voice-mode-icon">{mode === "brew" ? <BowlSteam size={21} /> : <ChatCircleDots size={21} />}</span></header>
      <p className="eyebrow">AI Companion · {session ? (isMock ? "演示模式" : "实时语音") : "尚未连接"}</p><h1 className="title">{title}</h1><p className="subtitle">{description}</p>
      {mode === "brew" && active ? <div className="stage-list">{STAGES.map(([value, label]) => <button key={value} className={`stage ${stage === value ? "active" : ""}`} onClick={() => void changeStage(value)}>{label}</button>)}</div> : null}
      <div className="voice-orb-wrap"><button aria-label="语音状态" className={`voice-orb ${active ? "active" : ""}`} disabled={!active || !isMock} onClick={startRecognition}>{listening ? <Waveform size={40} weight="bold" /> : <Microphone size={40} weight="duotone" />}</button><p>{active ? (listening ? "正在听你说" : "轻触后说出这一口") : "连接后，茶伴会在这里回应"}</p></div>
      <p className="status-pill voice-status"><span className="status-dot" />{status}</p>
      <div className="transcript">{turns.length ? turns.map((turn) => <div className={`turn ${turn.role}`} key={turn.clientTurnId}><small>{turn.role === "user" ? "你" : "Tea-BTI 茶伴"}</small>{turn.text}</div>) : <p className="empty">实时字幕会出现在这里</p>}</div>
      {active ? <div className="voice-composer"><textarea className="text-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="也可以直接输入你想说的话…" /><button className="button" aria-label="发送文字" onClick={submitText}><PaperPlaneTilt size={20} weight="fill" /></button></div> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="voice-primary-action">{!active ? <button disabled={busy} className="button primary block" onClick={() => void start()}><Microphone size={19} />开启麦克风，开始陪伴</button> : <button disabled={busy} className="button warm block" onClick={() => void stop()}><StopCircle size={19} />{mode === "brew" ? (stage === "complete" ? "结束并记为已泡过" : "结束本次陪伴") : "结束并保存"}</button>}</div>
      {mode === "brew" && active && stage !== "complete" ? <p className="voice-save-hint">只有明确进入“完成”阶段，才会写入“已泡过”。</p> : null}
    </section>
  );
}
