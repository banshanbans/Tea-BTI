"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Quotes, ShareNetwork, Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { authenticated } from "@/lib/api";
import type { TeaBti, TeaProfile } from "@/lib/api";
import { COMMON_COPY, TEA_BTI_AXES } from "@/lib/copy";
import { TEA_BTI_ENDPOINT_COPY, teaBtiAxisPercent, teaBtiStatusCopy } from "@/lib/tea-bti";
import { ProfileShareSheet } from "./ProfileShareSheet";

const HERO_TAGS: Record<string, string> = {
  F: "清鲜", M: "醇和", L: "轻盈", R: "浓郁",
  S: "香气先行", T: "滋味先行", E: "尝新", C: "守味",
};

type BehaviorEvidence = TeaBti["behaviorEvidence"][number];
type DialogueLine = NonNullable<TeaBti["personaDetail"]>["signatureMoment"][number];

function Dialogue({ lines }: { lines: DialogueLine[] }) {
  return (
    <div className="tea-bti-dialogue">
      {lines.map((line, index) => (
        <p key={`${line.speaker}-${index}`} className={index % 2 ? "is-reply" : ""}>
          <span>{line.speaker}</span><strong>{line.text}</strong>
        </p>
      ))}
    </div>
  );
}

function BehaviorEvidenceList({ items }: { items: BehaviorEvidence[] }) {
  if (!items.length) return <p className="tea-bti-evidence-empty">再留下几次选择，这里会出现只属于你的线索。</p>;
  return (
    <div className="tea-bti-behavior-list">
      {items.map((item, index) => {
        const action = item.kind === "like" ? "喜欢了" : item.kind === "save" ? "先收藏了" : item.kind === "skip" ? "这次划过了" : "真实品饮了";
        return (
          <article key={`${item.kind}-${item.tea.teaId}-${index}`}>
            <span>{action}</span><strong>{item.tea.name}</strong>
            {item.kind === "drink" && item.infusionNumber ? <small>第 {item.infusionNumber} 泡</small> : null}
            {item.userWords ? <blockquote>“{item.userWords}”</blockquote> : null}
          </article>
        );
      })}
    </div>
  );
}

export function TeaBtiDetailView() {
  const [profile, setProfile] = useState<TeaBti | null>(null);
  const [shareProfile, setShareProfile] = useState<TeaProfile | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState("");
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    void authenticated<TeaBti>("/me/tea-bti").then(setProfile).catch(() => setError("茶桌精神速写暂时还没展开。"));
  }, []);

  async function openShare() {
    setShareError("");
    if (shareProfile) {
      setShareOpen(true);
      return;
    }
    try {
      const result = await authenticated<TeaProfile>("/me/profile");
      setShareProfile(result);
      setShareOpen(true);
    } catch {
      setShareError("分享面板暂时没打开，再试一次。");
    }
  }

  if (error) return <section className="profile-focus-page"><p className="error">{error}</p><Link className="button" href="/profile">返回喝出来的我</Link></section>;
  if (!profile) return <div className="empty">{COMMON_COPY.loadingProfile}</div>;

  const detail = profile.personaDetail;
  const header = (
    <header className="profile-focus-header tea-bti-detail-header">
      <Link className="profile-icon-action" href="/profile" aria-label="返回喝出来的我"><ArrowLeft size={21} /></Link>
      <div><p className="eyebrow">Tea-BTI</p><h1>我的茶桌精神速写</h1></div>
      <button className="profile-icon-action" aria-label="分享 Tea-BTI" onClick={() => void openShare()}><ShareNetwork size={20} /></button>
    </header>
  );

  if (profile.state === "forming" || !profile.code || !detail) {
    return (
      <section className="profile-focus-page tea-bti-detail-page tea-bti-forming-page">
        {header}
        <section className="tea-bti-forming-hero">
          <p className="tea-bti-state-label">待形成</p>
          <h2>你的茶桌轮廓还在路上</h2>
          <p>每一次真实选择都算数。再喝、再选几杯，轮廓会慢慢清楚。</p>
        </section>
        <section className="tea-bti-detail-section">
          <p className="eyebrow">已经留下的线索</p><h2>先看看你做过的选择</h2>
          <BehaviorEvidenceList items={profile.behaviorEvidence} />
        </section>
        <Link className="tea-bti-progress-link" href="/"><span>{teaBtiStatusCopy(profile)}</span><ArrowRight size={17} /></Link>
        {shareError ? <p className="error" role="alert">{shareError}</p> : null}
        {shareOpen && shareProfile ? <ProfileShareSheet profile={shareProfile} onProfileChange={setShareProfile} onClose={() => setShareOpen(false)} /> : null}
      </section>
    );
  }

  return (
    <section className="profile-focus-page tea-bti-detail-page">
      {header}

      <section className="tea-bti-detail-hero">
        <p className="tea-bti-state-label">{profile.state === "stable" ? "逐渐稳定" : "初见"}</p>
        <h2>{profile.personaName}</h2><span>Tea-BTI · {profile.code}</span>
        <p className="tea-bti-punchline">{detail.punchline}</p>
        <div className="tea-bti-hero-tags" aria-label="四轴选择">
          {profile.code.split("").map((code) => <span key={code}>{code} · {HERO_TAGS[code]}</span>)}
        </div>
      </section>

      <section className="tea-bti-detail-section tea-bti-habits">
        <p className="eyebrow">茶桌习惯</p><h2>你可能有这些茶桌习惯</h2>
        <ul>{detail.symptoms.map((item) => <li key={item}><Check size={15} weight="bold" /><span>{item}</span></li>)}</ul>
      </section>

      <section className="tea-bti-detail-section tea-bti-contrasts">
        <p className="eyebrow">一点反差</p><h2>你以为 / 实际上</h2>
        <div>{detail.contrasts.map((item) => <article key={item.claim}><p><span>你以为</span>{item.claim}</p><p><span>实际上</span><strong>{item.reality}</strong></p></article>)}</div>
      </section>

      <section className="tea-bti-detail-section tea-bti-scenes">
        <p className="eyebrow">茶桌小剧场</p><h2>坐到茶桌上的你</h2>
        {detail.scenes.map((scene, index) => <article key={scene.title}><span>0{index + 1}</span><h3>{scene.title}</h3><Dialogue lines={scene.lines} /></article>)}
      </section>

      <section className="tea-bti-detail-section tea-bti-enemies">
        <p className="eyebrow">茶桌天敌</p><h2>听见这些话，你会停顿一下</h2>
        <ol>{detail.enemies.map((enemy, index) => <li key={enemy.trigger}><span>TOP {index + 1}</span><blockquote>“{enemy.trigger}”</blockquote><p><Warning size={16} />内心：<strong>{enemy.reaction}</strong></p></li>)}</ol>
      </section>

      <section className="tea-bti-screenshot-grid" aria-label="人格名场面">
        <article className="tea-bti-capture-panel">
          <p className="eyebrow">名场面</p><Quotes size={24} /><Dialogue lines={detail.signatureMoment} />
          <footer>{profile.personaName} · {profile.code}</footer>
        </article>
        <article className="tea-bti-capture-panel is-warning">
          <p className="eyebrow">千万别说</p><blockquote>“{detail.neverSay}”</blockquote>
          <footer>请给这位茶友留一点喝茶空间</footer>
        </article>
      </section>

      <section className="tea-bti-detail-section tea-bti-chemistry">
        <p className="eyebrow">茶桌 CP</p><h2>你遇见「{detail.chemistry.partnerName}」</h2>
        <span>Tea-BTI · {detail.chemistry.partnerCode}</span>
        <Dialogue lines={detail.chemistry.lines} />
        <p className="tea-bti-chemistry-summary">{detail.chemistry.summary}</p>
      </section>

      <section className="tea-bti-serious-turn">
        <p className="eyebrow">回到这一杯</p><h2>这不是结论。</h2>
        <p>{profile.personaSummary}</p><p>这是你最近喝出来的样子。下一杯，仍会让它继续生长。</p>
      </section>

      <section className="tea-bti-detail-axes" aria-label="四轴人格解读">
        {TEA_BTI_AXES.map(({ key, left, right }, index) => {
          const score = Number(profile.axes[key] ?? 0);
          const selectedCode = profile.code?.[index] || (score >= 0 ? left.code : right.code);
          const selected = selectedCode === left.code ? left : right;
          return (
            <article className="tea-bti-detail-axis" key={key}>
              <div className="tea-bti-detail-axis-head"><span>{left.code} {left.label}</span><span>{right.code} {right.label}</span></div>
              <div className="tea-identity-axis-track" aria-label={`${left.code} ${left.label}到${right.code} ${right.label}，当前偏向${selected.label}`}><i style={{ left: `${teaBtiAxisPercent(score)}%` }} /></div>
              <div className="tea-bti-detail-axis-copy"><strong>{selected.code} · {selected.label}</strong><p>{TEA_BTI_ENDPOINT_COPY[selected.code]}</p></div>
            </article>
          );
        })}
      </section>

      <section className="tea-bti-detail-section tea-bti-real-evidence">
        <p className="eyebrow">最近真实线索</p><h2>为什么最近是这个人格</h2>
        <BehaviorEvidenceList items={profile.behaviorEvidence} />
      </section>

      <Link className="tea-bti-progress-link tea-bti-final-cta" href="/"><span>继续刷，看看你会不会变</span><ArrowRight size={17} /></Link>
      {shareError ? <p className="error" role="alert">{shareError}</p> : null}
      {shareOpen && shareProfile ? <ProfileShareSheet profile={shareProfile} onProfileChange={setShareProfile} onClose={() => setShareOpen(false)} /> : null}
    </section>
  );
}
