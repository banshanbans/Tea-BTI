"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BowlSteam, ChatCircleDots, Check, Heart, MinusCircle, Mountains, ThumbsDown } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { TeaDetail, TeaJourney } from "@/lib/api";

const STEP_LABELS = {
  brew: "泡茶",
  taste: "品茶",
  realm: "茶境",
  passport: "护照",
} as const;

function stepHref(teaId: string, journey: TeaJourney, step = journey.nextStep): string {
  if (step === "brew") return `/brew/${teaId}`;
  if (step === "taste") return `/taste/${teaId}`;
  if (step === "realm" && journey.realmId) return `/realm/${journey.realmId}`;
  return "/passport";
}

function stepCta(step: TeaJourney["nextStep"]): string {
  return { brew: "开始陪泡", taste: "说出这一口", realm: "进入《雾里一芽》", passport: "查看茶护照" }[step];
}

export function TeaDetailView({ teaId }: { teaId: string }) {
  const [tea, setTea] = useState<TeaDetail | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void authenticated<TeaDetail>(`/teas/${teaId}`).then(setTea).catch((cause) => setError((cause as Error).message));
  }, [teaId]);

  async function feedback(result: "like" | "neutral" | "dislike") {
    try {
      await authenticated("/drink-feedback", { method: "POST", ...jsonBody({ teaId, result }) });
      const refreshed = await authenticated<TeaDetail>(`/teas/${teaId}`);
      setTea(refreshed);
      setNotice(result === "like" ? "记住了：这杯比想象中更喜欢。" : result === "dislike" ? "记住了：这杯暂时不太合拍。" : "已记录这次真实反馈。");
    } catch (cause) { setError((cause as Error).message); }
  }

  if (error) return <p className="error">{error}</p>;
  if (!tea) return <div className="empty">正在翻开这杯茶的资料…</div>;
  const journeySteps = [
    { id: "brew" as const, icon: BowlSteam, complete: tea.journey.brewed },
    { id: "taste" as const, icon: ChatCircleDots, complete: tea.journey.tasted },
    ...(tea.journey.realmId ? [{ id: "realm" as const, icon: Mountains, complete: tea.journey.realmCompleted }] : []),
    { id: "passport" as const, icon: BookOpen, complete: tea.journey.nextStep === "passport" },
  ];
  return (
    <section className="detail-page">
      <div className="detail-hero">
        <img src={mediaUrl(tea.visual.url)} style={{ objectPosition: tea.visual.objectPosition }} alt={tea.name} />
        <div className="detail-copy"><span className="eyebrow">你刚刚喜欢的那一杯 · {tea.region}</span><h1>{tea.name}</h1><div className="tags">{tea.professionalTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div>
      </div>
      <p className="detail-intro">{tea.officialDescription}</p>
      <section className="tea-journey" aria-labelledby="tea-journey-title">
        <div className="tea-journey-head"><div><p className="eyebrow">Guided Journey</p><h2 id="tea-journey-title">这一杯，接下来做什么</h2></div><span>{journeySteps.filter((step) => step.complete).length} / {journeySteps.length}</span></div>
        <ol className="journey-rail">{journeySteps.map((step) => {
          const Icon = step.icon;
          const current = tea.journey.nextStep === step.id;
          return <li key={step.id} className={`${step.complete ? "complete" : ""} ${current ? "current" : ""}`} aria-current={current ? "step" : undefined}><span>{step.complete ? <Check size={14} weight="bold" /> : <Icon size={16} />}</span><small>{STEP_LABELS[step.id]}</small></li>;
        })}</ol>
        <Link className="button primary block journey-primary" href={stepHref(tea.teaId, tea.journey)}>{stepCta(tea.journey.nextStep)} <ArrowRight size={18} /></Link>
        <p className="journey-guidance">推荐按顺序体验，但不会锁住你。茶境随时可以进入。</p>
        <details className="journey-explore"><summary>自由探索其他阶段</summary><div>
          <Link href={`/brew/${tea.teaId}`}><BowlSteam size={16} />陪泡</Link>
          <Link href={`/taste/${tea.teaId}`}><ChatCircleDots size={16} />陪品</Link>
          {tea.realmId ? <Link href={`/realm/${tea.realmId}`}><Mountains size={16} />茶境</Link> : null}
          <Link href="/passport"><BookOpen size={16} />护照</Link>
        </div></details>
      </section>
      <section className="panel detail-facts">
        <p className="eyebrow">Brewing Guide</p><h2 className="section-title">怎么泡</h2>
        <dl><div><dt>器具</dt><dd>{tea.brewingGuide.vessel}</dd></div><div><dt>水温</dt><dd>{tea.brewingGuide.temperatureRange}</dd></div><div><dt>时间</dt><dd>{tea.brewingGuide.steepTime}</dd></div></dl>
        <div className="fact-notes">{tea.brewingGuide.notes.map((note) => <p key={note}>{note}</p>)}</div>
      </section>
      <section className="panel feedback-panel">
        <p className="eyebrow">Real Taste</p><h2 className="section-title">真喝以后</h2>
        <p className="muted">真实反馈的权重比一次 Swipe 更高。</p>
        <div className="feedback-actions"><button className="button" onClick={() => void feedback("dislike")}><ThumbsDown size={17} />不太喜欢</button><button className="button" onClick={() => void feedback("neutral")}><MinusCircle size={17} />还在感受</button><button className="button primary" onClick={() => void feedback("like")}><Heart size={17} weight="fill" />更喜欢</button></div>
        {notice ? <p className="status-pill">{notice}</p> : null}
      </section>
    </section>
  );
}
