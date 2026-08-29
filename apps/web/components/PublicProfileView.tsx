"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Leaf } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { jsonBody, mediaUrl, publicRequest } from "@/lib/api";
import type { PublicTeaProfile } from "@/lib/api";

const AXES: Array<[string, string, string]> = [
  ["freshMellow", "清鲜", "醇和"],
  ["lightRich", "轻盈", "浓郁"],
  ["scentTaste", "香气", "滋味"],
  ["explorerComfort", "尝新", "熟悉"],
];

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
      <p className="eyebrow">Tea-BTI · Unlisted Profile</p>
      <h1>这个茶主页已经收起</h1>
      <p>主人可能撤销了旧链接。你仍然可以从自己的三杯茶开始。</p>
      <button className="button primary" aria-label="开始我的三杯 →" onClick={() => router.push("/?fromProfile=unavailable")}>开始我的三杯 <ArrowRight size={17} /></button>
    </main>
  );

  if (!profile) return <main className="public-profile-shell"><div className="empty">正在展开这张茶名片…</div></main>;

  const identity = profile.identity;
  return (
    <main className="public-profile-shell">
      <header className="public-profile-hero">
        <p className="eyebrow"><Leaf size={13} weight="fill" />Tea-BTI · Tea Profile</p>
        <span className="status-pill">不公开检索 · 可随时撤销</span>
        <h1>{identity.displayName}</h1>
        <p>{identity.bio || "Tea-BTI 不是测出来的，是喝出来的。"}</p>
        <div className="public-persona"><strong>{identity.teaBti.personaName || "正在形成"}</strong><span>{identity.teaBti.code ? `Tea-BTI · ${identity.teaBti.code}` : "喝得越真实，轮廓越清楚"}</span></div>
        <div className="public-profile-axes">
          {AXES.map(([key, left, right]) => {
            const score = Number(identity.teaBti.axes[key] ?? 0);
            const percent = Math.max(4, Math.min(96, 50 + score * 46));
            return <div key={key}><span>{left}</span><div><i style={{ width: `${percent}%` }} /></div><span>{right}</span></div>;
          })}
        </div>
      </header>

      {profile.myTea ? (
        <section className="public-profile-block public-tea-block">
          <p className="eyebrow">MY_TEA</p><h2>我的本命茶</h2>
          <img src={mediaUrl(profile.myTea.visual.url)} alt={profile.myTea.name} />
          <div><strong>{profile.myTea.name}</strong><span>{profile.myTea.region} · {profile.myTea.teaType}</span><p>{profile.myTea.professionalTags.join(" · ")}</p></div>
        </section>
      ) : null}

      {profile.myWords ? (
        <section className="public-profile-block public-words-block">
          <p className="eyebrow">MY_WORDS</p><h2>我怎么说这一口</h2>
          <blockquote>“{profile.myWords.text}”</blockquote>
          <p>{profile.myWords.tea.name} · {profile.myWords.normalizedTags.join(" / ") || "自己的话"}</p>
        </section>
      ) : null}

      {profile.teaPassport ? (
        <section className="public-profile-block public-passport-block">
          <p className="eyebrow">TEA_PASSPORT</p><h2>留下过的茶</h2>
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
        <p className="eyebrow">Now, your turn</p><h2>看完 TA 的一杯，<br />从你的三杯开始。</h2>
        <p>已有刷茶记录也不会被清空。MBTI 只负责破冰，真实选择会继续留在你的茶护照里。</p>
        <button className="button primary block" aria-label={starting ? "正在准备三杯…" : "开始我的三杯 →"} disabled={starting} onClick={() => void startOnboarding()}>{starting ? "正在准备三杯…" : <>开始我的三杯 <ArrowRight size={18} /></>}</button>
      </section>
      <footer className="public-profile-footer">Tea-BTI · 喝出来的风味身份</footer>
    </main>
  );
}
