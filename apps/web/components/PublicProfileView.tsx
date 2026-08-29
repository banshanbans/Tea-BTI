"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Leaf } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { jsonBody, mediaUrl, publicRequest } from "@/lib/api";
import type { PublicTeaProfile } from "@/lib/api";
import { TEA_BTI_AXES } from "@/lib/copy";

function eventId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function PublicProfileView({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<PublicTeaProfile | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void publicRequest<PublicTeaProfile>(`/public/profiles/${encodeURIComponent(publicId)}`)
      .then((result) => {
        setProfile(result);
        void publicRequest(`/public/profiles/${encodeURIComponent(publicId)}/events`, {
          method: "POST",
          ...jsonBody({ clientEventId: eventId("public-open"), eventType: "public_profile_opened" }),
        }).catch(() => undefined);
      })
      .catch(() => setUnavailable(true));
  }, [publicId]);

  async function startOnboarding() {
    setStarting(true);
    try {
      await publicRequest(`/public/profiles/${encodeURIComponent(publicId)}/events`, {
        method: "POST",
        ...jsonBody({ clientEventId: eventId("profile-cta"), eventType: "profile_cta_started" }),
      });
    } catch {
      // Attribution must never block the visitor's own onboarding.
    } finally {
      router.push(`/?fromProfile=${encodeURIComponent(publicId)}`);
    }
  }

  if (unavailable) return (
    <main className="public-profile-shell public-profile-unavailable">
      <p className="eyebrow">Tea-BTI 茶主页</p>
      <h1>这个茶主页已经收起</h1>
      <p>链接已经落幕。你的三杯茶，还可以从这里开始。</p>
      <button className="button primary" aria-label="开始我的三杯 →" onClick={() => router.push("/?fromProfile=unavailable")}>开始我的三杯 <ArrowRight size={17} /></button>
    </main>
  );

  if (!profile) return <main className="public-profile-shell"><div className="empty">正在展开这张茶名片…</div></main>;

  const identity = profile.identity;
  return (
    <main className="public-profile-shell">
      <header className="public-profile-hero">
        <p className="eyebrow"><Leaf size={13} weight="fill" />Tea-BTI 茶主页</p>
        <span className="status-pill">仅持链接可见 · 随时可收起</span>
        <h1>{identity.displayName}</h1>
        <p>{identity.bio || "一杯一杯，慢慢喝出自己的轮廓。"}</p>
        <div className="public-persona">
          <strong>{identity.teaBti.personaName || "正在形成"}</strong>
          <span>{identity.teaBti.code ? `Tea-BTI · ${identity.teaBti.code}` : "喝得越真实，轮廓越清楚"}</span>
          {identity.teaBti.personaSummary ? <p>{identity.teaBti.personaSummary}</p> : null}
        </div>
        <div className="public-profile-axes" aria-label="Tea-BTI 四轴">
          {TEA_BTI_AXES.map(({ key, left, right }) => {
            const score = Number(identity.teaBti.axes[key] ?? 0);
            const percent = Math.max(4, Math.min(96, 50 + score * 46));
            return <div key={key}>
              <span><b>{left.code}</b>{left.label}</span>
              <div><i style={{ width: `${percent}%` }} /></div>
              <span><b>{right.code}</b>{right.label}</span>
            </div>;
          })}
        </div>
      </header>

      {profile.myTea ? (
        <section className="public-profile-block public-tea-block">
          <p className="eyebrow">我的茶</p><h2>我的本命茶</h2>
          <img src={mediaUrl(profile.myTea.visual.url)} alt={profile.myTea.name} />
          <div><strong>{profile.myTea.name}</strong><span>{profile.myTea.region} · {profile.myTea.teaType}</span><p>{profile.myTea.professionalTags.join(" · ")}</p></div>
        </section>
      ) : null}

      {profile.myWords ? (
        <section className="public-profile-block public-words-block">
          <p className="eyebrow">我的话</p><h2>我怎么说这一口</h2>
          <blockquote>“{profile.myWords.text}”</blockquote>
          <p>{profile.myWords.tea.name} · {profile.myWords.normalizedTags.join(" / ") || "自己的话"}</p>
        </section>
      ) : null}

      {profile.teaPassport ? (
        <section className="public-profile-block public-passport-block">
          <p className="eyebrow">喝过的茶</p><h2>留下过的茶</h2>
          <div className="public-passport-list">
            {profile.teaPassport.items.map((item) => (
              <article key={item.tea.teaId}>
                <img src={mediaUrl(item.tea.visual.url)} alt="" />
                <div><strong>{item.tea.name}</strong><span>{[item.saved && "收藏", item.brewed && "泡过", item.tasted && "品过", item.realmUnlocked && "完成茶境"].filter(Boolean).join(" · ")}</span>{item.specimens.map((specimen) => <small key={specimen.specimenId}>数字标本 · {specimen.name}</small>)}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="public-profile-cta">
        <p className="eyebrow">轮到你的三杯</p><h2>看完 TA 的一杯，<br />从你的三杯开始。</h2>
        <p>你原来的记录都在。挑一个 MBTI，再见三杯新茶。</p>
        <button className="button primary block" aria-label={starting ? "正在准备三杯…" : "开始我的三杯 →"} disabled={starting} onClick={() => void startOnboarding()}>{starting ? "正在准备三杯…" : <>开始我的三杯 <ArrowRight size={18} /></>}</button>
      </section>
      <footer className="public-profile-footer">Tea-BTI · 喝出来的风味身份</footer>
    </main>
  );
}
