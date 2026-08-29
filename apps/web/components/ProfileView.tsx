"use client";

import Link from "next/link";
import { ArrowRight, PencilSimple, ShareNetwork } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { TeaProfile } from "@/lib/api";
import { COMMON_COPY, TEA_BTI_AXES } from "@/lib/copy";
import { teaDetailHref } from "@/lib/navigation";
import { eventId } from "@/lib/profile";
import { teaBtiAxisPercent, teaBtiStatusCopy } from "@/lib/tea-bti";
import { ProfileShareSheet } from "./ProfileShareSheet";

const HERO_AXIS_LABELS: Record<string, [string, string]> = {
  freshMellow: ["清鲜", "醇和"],
  lightRich: ["轻盈", "浓郁"],
  scentTaste: ["香气", "滋味"],
  explorerComfort: ["尝新", "守味"],
};

function TeaIdentityAxes({ profile }: { profile: TeaProfile["teaBti"] }) {
  return (
    <div className="tea-identity-axes" aria-label="Tea-BTI 四轴">
      {TEA_BTI_AXES.map(({ key, left, right }) => {
        const score = Number(profile.axes[key] ?? 0);
        const [shortLeft, shortRight] = HERO_AXIS_LABELS[key];
        const selected = score >= 0 ? left : right;
        return (
          <div className="tea-identity-axis" key={key}>
            <div className="tea-identity-axis-labels"><span>{shortLeft}</span><span>{shortRight}</span></div>
            <div className="tea-identity-axis-track" aria-label={`${left.code} ${left.label}到${right.code} ${right.label}，当前偏向${selected.label}`}><i style={{ left: `${teaBtiAxisPercent(score)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function ProfileView() {
  const [profile, setProfile] = useState<TeaProfile | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void authenticated<TeaProfile>("/me/profile")
      .then((result) => {
        setProfile(result);
        return authenticated("/me/profile/events", {
          method: "POST",
          ...jsonBody({ clientEventId: eventId("profile-view"), eventType: "tea_profile_viewed" }),
        });
      })
      .catch(() => setError("茶主页暂时没整理好。"));
  }, []);

  const selectedTea = profile?.selectedTea || null;
  const selectedQuote = profile?.quoteCandidates.find((item) => item.feedbackId === profile.settings.sourceFeedbackId);
  const passport = profile?.passport.items || [];

  function openShare() {
    if (!profile) return;
    setError("");
    setShareOpen(true);
  }

  if (error && !profile) return <p className="error">{error}</p>;
  if (!profile) return <div className="empty">{COMMON_COPY.loadingProfile}</div>;

  const tastedCount = passport.filter((item) => item.tasted).length;
  const specimenCount = passport.reduce((count, item) => count + (item.specimens || []).length, 0);

  return (
    <section className="profile-page profile-single-identity">
      <header className="profile-heading">
        <h1 className="title">喝出来的我</h1>
        <div className="profile-heading-actions">
          <button className="profile-icon-action" aria-label="分享 Tea-BTI" onClick={openShare}><ShareNetwork size={20} /></button>
          <Link className="profile-icon-action" href="/profile/edit" aria-label="编辑茶主页"><PencilSimple size={20} /></Link>
        </div>
      </header>

      <section className="tea-identity-hero">
        <p className="tea-bti-state-label">{profile.teaBti.state === "stable" ? "逐渐稳定" : profile.teaBti.state === "early" ? "初见" : "形成中"}</p>
        <h2>{profile.teaBti.personaName || "轮廓正在形成"}</h2>
        <span className="tea-identity-code">{profile.teaBti.code ? `Tea-BTI · ${profile.teaBti.code}` : "Tea-BTI · 正在形成"}</span>
        <p className="tea-identity-summary">{profile.teaBti.personaSummary || "每一次真实选择，都在让风味轮廓慢慢清楚。"}</p>
        <TeaIdentityAxes profile={profile.teaBti} />
        <Link className="tea-identity-detail-link" href="/profile/tea-bti">查看我的人格解读 <ArrowRight size={16} /></Link>
        <Link className="tea-bti-progress-link compact" href="/"><span>{teaBtiStatusCopy(profile.teaBti)}</span><ArrowRight size={15} /></Link>
      </section>

      <section className="profile-traces">
        <h2>我的茶迹</h2>

        {selectedTea ? (
          <Link className="profile-signature-tea" href={teaDetailHref(selectedTea.teaId, "profile")}>
            <img src={mediaUrl(selectedTea.visual.url)} alt={selectedTea.name} />
            <span><small>我的本命茶</small><strong>{selectedTea.name}</strong><em>{selectedTea.region} · {selectedTea.teaType}</em></span>
            <ArrowRight size={18} />
          </Link>
        ) : (
          <Link className="profile-trace-empty" href="/">下一次喜欢、收藏或真喝，都可能带来你的本命茶。<ArrowRight size={16} /></Link>
        )}

        <section className="profile-words-trace">
          <h3>我说过</h3>
          {profile.settings.publicQuote && selectedQuote ? <blockquote>“{profile.settings.publicQuote}”<footer>—— {selectedQuote.tea.name}</footer></blockquote> : <p>说过并保存的那句话，会在这里等你。</p>}
        </section>

        <Link className="profile-passport-trace" href="/passport">
          <h3>茶护照</h3>
          <div><span><strong>{passport.length}</strong><small>款茶</small></span><span><strong>{tastedCount}</strong><small>品过</small></span><span><strong>{specimenCount}</strong><small>标本</small></span></div>
          <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="profile-continue">
        <p>继续喝，身份会跟着下一杯生长。</p>
        <Link href="/">去刷茶 <ArrowRight size={16} /></Link>
      </footer>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {shareOpen ? <ProfileShareSheet profile={profile} onProfileChange={setProfile} onClose={() => setShareOpen(false)} /> : null}
    </section>
  );
}
