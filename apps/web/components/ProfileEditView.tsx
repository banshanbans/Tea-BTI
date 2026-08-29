"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { authenticated, jsonBody } from "@/lib/api";
import type { ProfileBlockId, TeaProfile, TeaProfileMutation } from "@/lib/api";
import { COMMON_COPY } from "@/lib/copy";
import {
  eventId,
  profileToForm,
  profileUpdateBody,
  togglePublicBlock,
  type ProfileFormState,
} from "@/lib/profile";
import { ProfileVisibilityControls } from "./ProfileVisibilityControls";

export function ProfileEditView() {
  const router = useRouter();
  const [profile, setProfile] = useState<TeaProfile | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void authenticated<TeaProfile>("/me/profile")
      .then((result) => {
        setProfile(result);
        setForm(profileToForm(result));
      })
      .catch(() => setError("编辑页暂时没准备好。"));
  }, []);

  async function saveProfile() {
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      await authenticated<TeaProfileMutation>("/me/profile", {
        method: "PUT",
        ...jsonBody(profileUpdateBody(form, eventId("profile-edit"))),
      });
      router.push("/profile");
    } catch {
      setError("这次修改还没收好，再试一次。");
    } finally {
      setBusy(false);
    }
  }

  if (error && !profile) return <main className="profile-focus-page"><p className="error">{error}</p><Link className="button" href="/profile">返回我的 Tea-BTI</Link></main>;
  if (!profile || !form) return <div className="empty">{COMMON_COPY.loadingProfile}</div>;

  const completeness: Partial<Record<ProfileBlockId, boolean>> = {
    MY_TEA: Boolean(form.selectedTeaId),
    MY_WORDS: Boolean(form.sourceFeedbackId && form.publicQuote.trim()),
    TEA_PASSPORT: profile.passport.items.length > 0,
  };

  return (
    <section className="profile-focus-page profile-edit-page">
      <header className="profile-focus-header">
        <Link className="profile-icon-action" href="/profile" aria-label="取消编辑并返回"><ArrowLeft size={21} /></Link>
        <div><p className="eyebrow">我的茶主页</p><h1>编辑</h1></div>
        <button className="profile-text-action" disabled={busy} onClick={() => void saveProfile()}>{busy ? "保存中" : "保存"}</button>
      </header>

      <section className="profile-edit-section">
        <div className="profile-section-heading"><h2>公开主页资料</h2><p>这些内容只出现在编辑页和公开茶主页。</p></div>
        <div className="stack">
          <label className="field-label">昵称<input className="profile-input" minLength={2} maxLength={24} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
          <label className="field-label">简介<textarea className="profile-input profile-textarea" maxLength={80} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
        </div>
      </section>

      <section className="profile-edit-section">
        <div className="profile-section-heading"><h2>我的茶迹</h2><p>从真实留下的内容里，选出主页上的一杯和一句话。</p></div>
        <div className="stack">
          <label className="field-label">本命茶
            <select className="profile-input" aria-label="本命茶" value={form.selectedTeaId} onChange={(event) => {
              const selectedTeaId = event.target.value;
              setForm({
                ...form,
                selectedTeaId,
                publicBlockIds: selectedTeaId ? form.publicBlockIds : togglePublicBlock(form.publicBlockIds, "MY_TEA", false),
              });
            }}>
              <option value="">暂不选择</option>
              {profile.teaCandidates.map((candidate) => <option key={candidate.tea.teaId} value={candidate.tea.teaId}>{candidate.tea.name} · {candidate.evidenceReasons.join(" / ")}</option>)}
            </select>
          </label>
          <label className="field-label">我说过
            <select className="profile-input" aria-label="我说过" value={form.sourceFeedbackId} onChange={(event) => {
              const source = profile.quoteCandidates.find((item) => item.feedbackId === event.target.value);
              setForm({
                ...form,
                sourceFeedbackId: event.target.value,
                publicQuote: source?.text.slice(0, 120) || "",
                publicBlockIds: source ? form.publicBlockIds : togglePublicBlock(form.publicBlockIds, "MY_WORDS", false),
              });
            }}>
              <option value="">暂不选择</option>
              {profile.quoteCandidates.map((candidate) => <option key={candidate.feedbackId} value={candidate.feedbackId}>{candidate.tea.name} · {candidate.text}</option>)}
            </select>
          </label>
          <label className="field-label">公开版本<textarea className="profile-input profile-textarea" maxLength={120} disabled={!form.sourceFeedbackId} value={form.publicQuote} onChange={(event) => {
            const publicQuote = event.target.value;
            setForm({
              ...form,
              publicQuote,
              publicBlockIds: publicQuote.trim() ? form.publicBlockIds : togglePublicBlock(form.publicBlockIds, "MY_WORDS", false),
            });
          }} /></label>
          <small className="muted">{form.publicQuote.length} / 120 字</small>
        </div>
      </section>

      <section className="profile-edit-section">
        <div className="profile-section-heading"><h2>分享范围</h2><p>只有你勾选的茶迹会出现在公开链接里。</p></div>
        <ProfileVisibilityControls
          profile={profile}
          blockIds={form.publicBlockIds}
          completeness={completeness}
          onChange={(blockId, enabled) => setForm({ ...form, publicBlockIds: togglePublicBlock(form.publicBlockIds, blockId, enabled) })}
        />
      </section>

      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="button primary block profile-edit-save" disabled={busy} onClick={() => void saveProfile()}><Check size={17} weight="bold" />{busy ? "正在保存" : "保存茶主页"}</button>
      <Link className="profile-cancel-link" href="/profile">取消并返回</Link>
    </section>
  );
}
