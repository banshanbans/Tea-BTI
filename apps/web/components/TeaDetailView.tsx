"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BowlSteam, ChatCircleDots, Check, Heart, MinusCircle, Mountains, ThumbsDown } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { BackControl } from "@/components/BackControl";
import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { TeaDetail, TeaJourney } from "@/lib/api";
import { realmFromTeaHref, teaOriginHref, teaStepHref } from "@/lib/navigation";
import type { TeaOrigin } from "@/lib/navigation";

const STEP_LABELS = {
  brew: "泡茶",
  taste: "品茶",
  realm: "茶境",
  passport: "护照",
} as const;

function stepHref(teaId: string, journey: TeaJourney, origin: TeaOrigin, step = journey.nextStep): string {
  if (step === "brew") return teaStepHref("brew", teaId, origin);
  if (step === "taste") return teaStepHref("taste", teaId, origin);
  if (step === "realm" && journey.realmId) return realmFromTeaHref(journey.realmId, teaId, origin);
  return "/passport";
}

function stepCta(step: TeaJourney["nextStep"]): string {
  return { brew: "开始陪泡", taste: "说出这一口", realm: "进入《雾里一芽》", passport: "查看茶护照" }[step];
}

export function TeaDetailView({ teaId, origin = "swipe" }: { teaId: string; origin?: TeaOrigin }) {
  const [tea, setTea] = useState<TeaDetail | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void authenticated<TeaDetail>(`/teas/${teaId}`).then(setTea).catch(() => setError("这杯茶的资料暂时没翻开。"));
  }, [teaId]);

  async function feedback(result: "like" | "neutral" | "dislike") {
    try {
      await authenticated("/drink-feedback", { method: "POST", ...jsonBody({ teaId, result }) });
      const refreshed = await authenticated<TeaDetail>(`/teas/${teaId}`);
      setTea(refreshed);
      setNotice(result === "like" ? "这一杯，喜欢。" : result === "dislike" ? "这一杯，先放下。" : "这一口，先记着。");
    } catch { setError("这次感受还没记下，再点一次。"); }
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
        <BackControl ariaLabel={`返回${origin === "passport" ? "茶护照" : origin === "profile" ? "喝出来的我" : "刷茶"}`} className="detail-back-control" href={teaOriginHref(origin)} />
        <img src={mediaUrl(tea.detailVisual.url)} style={{ objectPosition: tea.detailVisual.objectPosition }} alt={tea.detailVisual.alt} />
        <div className="detail-copy"><span className="eyebrow">{tea.region}</span><h1>{tea.name}</h1><div className="tags">{tea.professionalTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div>
      </div>
      <p className="detail-intro">{tea.officialDescription}</p>
      <section className="panel tea-character" aria-labelledby="representative-features-title">
        <p className="eyebrow">这杯茶的样子</p><h2 id="representative-features-title" className="section-title">代表特点</h2>
        <p className="detail-section-copy">{tea.representativeFeatures}</p>
        {tea.process.length ? <p className="detail-process"><span>有资料依据的工艺线索</span>{tea.process.join(" · ")}</p> : null}
      </section>
      <section className="panel tea-character" aria-labelledby="aroma-taste-title">
        <p className="eyebrow">闻香与入口</p><h2 id="aroma-taste-title" className="section-title">香气与滋味</h2>
        <p className="detail-section-copy">{tea.aromaAndTaste}</p>
      </section>
      <section className="panel tea-character" aria-labelledby="personality-keywords-title">
        <p className="eyebrow">Tea-BTI 破冰语言</p><h2 id="personality-keywords-title" className="section-title">性格关键词</h2>
        <div className="personality-keywords" aria-label="Tea-BTI 性格关键词">{tea.personalityKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
      </section>
      <section className="tea-journey" aria-labelledby="tea-journey-title">
        <div className="tea-journey-head"><div><p className="eyebrow">这一杯的路</p><h2 id="tea-journey-title">接着往下走</h2></div><span>{journeySteps.filter((step) => step.complete).length} / {journeySteps.length}</span></div>
        <ol className="journey-rail">{journeySteps.map((step) => {
          const Icon = step.icon;
          const current = tea.journey.nextStep === step.id;
          return <li key={step.id} className={`${step.complete ? "complete" : ""} ${current ? "current" : ""}`} aria-current={current ? "step" : undefined}><span>{step.complete ? <Check size={14} weight="bold" /> : <Icon size={16} />}</span><small>{STEP_LABELS[step.id]}</small></li>;
        })}</ol>
        <Link className="button primary block journey-primary" href={stepHref(tea.teaId, tea.journey, origin)}>{stepCta(tea.journey.nextStep)} <ArrowRight size={18} /></Link>
        <p className="journey-guidance">顺着喝，也可以随时去茶境看看。</p>
        <details className="journey-explore"><summary>想先去别处看看</summary><div>
          <Link href={teaStepHref("brew", tea.teaId, origin)}><BowlSteam size={16} />陪泡</Link>
          <Link href={teaStepHref("taste", tea.teaId, origin)}><ChatCircleDots size={16} />陪品</Link>
          {tea.realmId ? <Link href={realmFromTeaHref(tea.realmId, tea.teaId, origin)}><Mountains size={16} />茶境</Link> : null}
          <Link href="/passport"><BookOpen size={16} />护照</Link>
        </div></details>
      </section>
      <section className="panel detail-facts">
        <p className="eyebrow">泡法</p><h2 className="section-title">冲泡建议</h2>
        <dl>
          <div><dt>器具</dt><dd>{tea.brewingGuide.vessel}</dd></div>
          <div><dt>水温</dt><dd>{tea.brewingGuide.temperatureRange}</dd></div>
          <div><dt>茶量</dt><dd>{tea.brewingGuide.teaAmount}</dd></div>
          <div><dt>水量</dt><dd>{tea.brewingGuide.waterVolume}</dd></div>
          <div><dt>方式</dt><dd>{tea.brewingGuide.method}</dd></div>
          {tea.brewingGuide.steepTime ? <div><dt>时间</dt><dd>{tea.brewingGuide.steepTime}</dd></div> : null}
        </dl>
        <div className="fact-notes">{tea.brewingGuide.notes.map((note) => <p key={note}>{note}</p>)}</div>
      </section>
      <details className="panel evidence-panel">
        <summary><span><span className="eyebrow">资料依据</span><strong>查看公开来源与图片边界</strong></span></summary>
        <div className="evidence-list">
          {tea.evidenceRefs.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><strong>{source.label}</strong><span>{source.supports.join(" · ")}</span></a>)}
          <a href={tea.detailVisual.sourceUrl} target="_blank" rel="noreferrer"><strong>详情实拍图来源页</strong><span>{tea.detailVisual.credit}</span></a>
        </div>
        <p className="rights-note">{tea.detailVisual.rightsNote}</p>
      </details>
      <section className="panel feedback-panel">
        <p className="eyebrow">喝过再说</p><h2 className="section-title">这一口，合拍吗？</h2>
        <p className="muted">喝完，留下最直接的感觉。</p>
        <div className="feedback-actions"><button className="button" onClick={() => void feedback("dislike")}><ThumbsDown size={17} />不太喜欢</button><button className="button" onClick={() => void feedback("neutral")}><MinusCircle size={17} />还在感受</button><button className="button primary" onClick={() => void feedback("like")}><Heart size={17} weight="fill" />更喜欢</button></div>
        {notice ? <p className="status-pill">{notice}</p> : null}
      </section>
    </section>
  );
}
