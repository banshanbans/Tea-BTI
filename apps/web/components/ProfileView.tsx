"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, Check, Copy, PencilSimple, QrCode, ShareNetwork, Trash, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type {
  ProfileBlockId,
  ProfileShareMutation,
  TeaProfile,
  TeaProfileMutation,
} from "@/lib/api";

const AXES: Array<[string, string, string]> = [
  ["freshMellow", "清鲜", "醇和"],
  ["lightRich", "轻盈", "浓郁"],
  ["scentTaste", "香气", "滋味"],
  ["explorerComfort", "尝新", "熟悉"],
];

const BLOCK_LABELS: Record<ProfileBlockId, string> = {
  IDENTITY: "IDENTITY / 我是谁",
  MY_TEA: "MY_TEA / 我的本命茶",
  MY_WORDS: "MY_WORDS / 我的原话",
  TEA_PASSPORT: "TEA_PASSPORT / 茶护照",
};

type FormState = {
  displayName: string;
  bio: string;
  selectedTeaId: string;
  sourceFeedbackId: string;
  publicQuote: string;
  publicBlockIds: ProfileBlockId[];
};

function toForm(profile: TeaProfile): FormState {
  return {
    displayName: profile.settings.displayName,
    bio: profile.settings.bio,
    selectedTeaId: profile.settings.selectedTeaId || "",
    sourceFeedbackId: profile.settings.sourceFeedbackId || "",
    publicQuote: profile.settings.publicQuote || "",
    publicBlockIds: profile.settings.publicBlockIds,
  };
}

function eventId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function TeaBtiAxes({ profile }: { profile: TeaProfile["teaBti"] }) {
  return (
    <div className="profile-axes" aria-label="Tea-BTI 四轴">
      {AXES.map(([key, left, right]) => {
        const score = Number(profile.axes[key] ?? 0);
        const percent = Math.max(4, Math.min(96, 50 + score * 46));
        return (
          <div className="axis" key={key}>
            <div className="topbar profile-axis-labels"><span>{left}</span><span className="muted">{right}</span></div>
            <div className="axis-line"><span style={{ width: `${percent}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function VisibilityControl({
  blockId,
  checked,
  onChange,
}: {
  blockId: ProfileBlockId;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (blockId === "IDENTITY") return <span className="profile-privacy public">始终公开</span>;
  return (
    <label className="profile-visibility">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{checked ? "分享时公开" : "仅自己可见"}</span>
    </label>
  );
}

export function ProfileView() {
  const [profile, setProfile] = useState<TeaProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void authenticated<TeaProfile>("/me/profile")
      .then((result) => {
        setProfile(result);
        setForm(toForm(result));
        return authenticated("/me/profile/events", {
          method: "POST",
          ...jsonBody({ clientEventId: eventId("profile-view"), eventType: "tea_profile_viewed" }),
        });
      })
      .catch((cause) => setError((cause as Error).message));
  }, []);

  const publicUrl = profile?.share.active && profile.share.publicPath && origin
    ? `${origin}${profile.share.publicPath}`
    : "";

  useEffect(() => {
    if (!publicUrl) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: { dark: "#18211a", light: "#fffdf7" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [publicUrl]);

  const publicBlockLabels = useMemo(() => (
    profile?.settings.publicBlockIds.map((blockId) => BLOCK_LABELS[blockId]) || []
  ), [profile]);

  function togglePublicBlock(blockId: ProfileBlockId, enabled: boolean) {
    if (!form || blockId === "IDENTITY") return;
    const requested = new Set(form.publicBlockIds);
    if (enabled) requested.add(blockId);
    else requested.delete(blockId);
    setForm({
      ...form,
      publicBlockIds: (["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"] as ProfileBlockId[])
        .filter((id) => requested.has(id)),
    });
  }

  async function saveProfile() {
    if (!form) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authenticated<TeaProfileMutation>("/me/profile", {
        method: "PUT",
        ...jsonBody({
          clientEventId: eventId("profile-edit"),
          displayName: form.displayName,
          bio: form.bio,
          selectedTeaId: form.selectedTeaId || null,
          sourceFeedbackId: form.sourceFeedbackId || null,
          publicQuote: form.sourceFeedbackId ? form.publicQuote : null,
          publicBlockIds: form.publicBlockIds,
        }),
      });
      setProfile(result.profile);
      setForm(toForm(result.profile));
      setEditing(false);
      setNotice("茶主页已保存");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createShare() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authenticated<ProfileShareMutation>("/me/profile/share", {
        method: "POST",
        ...jsonBody({ clientEventId: eventId("profile-share") }),
      });
      setProfile((current) => current ? { ...current, share: result.share } : current);
      setNotice("新的私密分享链接已生成");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(publicUrl);
      else {
        const input = document.createElement("textarea");
        input.value = publicUrl;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setNotice("链接已复制");
    } catch {
      setError("复制失败，请长按链接复制");
    }
  }

  async function systemShare() {
    if (!publicUrl) return;
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${profile?.settings.displayName || "一位喝茶的人"}的茶主页`,
        text: "来看看我喝出来的 Tea Profile，也从三杯茶开始认识你自己。",
        url: publicUrl,
      });
      setNotice("已打开系统分享");
    } catch (cause) {
      if ((cause as DOMException).name !== "AbortError") setError("系统分享暂不可用，可以复制链接");
    }
  }

  async function revokeShare() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authenticated<ProfileShareMutation>("/me/profile/share", {
        method: "DELETE",
        headers: { "X-Client-Event-Id": eventId("profile-revoke") },
      });
      setProfile((current) => current ? { ...current, share: result.share } : current);
      setNotice("旧链接已立即失效");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !profile) return <p className="error">{error}</p>;
  if (!profile || !form) return <div className="empty">正在整理你的茶主页…</div>;

  const selectedTea = profile.selectedTea;
  const selectedQuote = profile.quoteCandidates.find((item) => item.feedbackId === profile.settings.sourceFeedbackId);
  const passport = profile.passport.items;

  return (
    <section className="profile-page">
      <div className="profile-heading">
        <div><p className="eyebrow">My Tea Profile · v0</p><h1 className="title">喝出来的我</h1></div>
        <button className="button compact" onClick={() => {
          if (editing) setForm(toForm(profile));
          setEditing(!editing);
          setError("");
        }}>{editing ? <><X size={16} />取消</> : <><PencilSimple size={16} />编辑</>}</button>
      </div>
      <p className="subtitle">四块真实证据，拼成一张可以随时收回的茶名片。</p>

      <div className="profile-blocks">
        <article className="profile-block identity-block">
          <div className="profile-block-head"><p className="eyebrow">IDENTITY</p><VisibilityControl blockId="IDENTITY" checked onChange={() => undefined} /></div>
          {editing ? (
            <div className="stack">
              <label className="field-label">昵称<input className="profile-input" minLength={2} maxLength={24} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
              <label className="field-label">简介<textarea className="profile-input profile-textarea" maxLength={80} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
            </div>
          ) : (
            <><h2>{profile.settings.displayName}</h2><p>{profile.settings.bio || "还没有写简介。先喝几杯，也可以先写下你为什么来到这里。"}</p></>
          )}
          <div className="profile-bti-title"><strong>{profile.teaBti.personaName || "正在形成"}</strong><span>{profile.teaBti.code ? `Tea-BTI · ${profile.teaBti.code}` : "Tea-BTI 正在形成"}</span></div>
          <TeaBtiAxes profile={profile.teaBti} />
          {profile.teaBti.state === "forming" ? <div className="profile-formation-evidence"><strong>怎样让它更清晰</strong>{profile.teaBti.evidence.map((item) => <p key={item}><Check size={13} weight="bold" />{item}</p>)}</div> : null}
        </article>

        <article className="profile-block tea-block">
          <div className="profile-block-head"><p className="eyebrow">MY_TEA</p>{editing ? <VisibilityControl blockId="MY_TEA" checked={form.publicBlockIds.includes("MY_TEA")} onChange={(value) => togglePublicBlock("MY_TEA", value)} /> : <span className={`profile-privacy ${profile.settings.publicBlockIds.includes("MY_TEA") ? "public" : "private"}`}>{profile.settings.publicBlockIds.includes("MY_TEA") ? "公开" : "私密"}</span>}</div>
          <h2>我的本命茶</h2>
          {editing ? (
            <label className="field-label">只可从真实行为候选中选择
              <select className="profile-input" value={form.selectedTeaId} onChange={(event) => setForm({ ...form, selectedTeaId: event.target.value })}>
                <option value="">暂不选择</option>
                {profile.teaCandidates.map((candidate) => <option key={candidate.tea.teaId} value={candidate.tea.teaId}>{candidate.tea.name} · {candidate.evidenceReasons.join(" / ")}</option>)}
              </select>
            </label>
          ) : selectedTea ? (
            <div className="profile-tea-summary"><img src={mediaUrl(selectedTea.visual.url)} alt={selectedTea.name} /><div><strong>{selectedTea.name}</strong><span>{selectedTea.region} · {selectedTea.teaType}</span><small>{selectedTea.professionalTags.join(" · ")}</small></div></div>
          ) : <p className="profile-empty-copy">正在形成。喜欢、收藏或真喝一杯后，候选才会出现。</p>}
        </article>

        <article className="profile-block words-block">
          <div className="profile-block-head"><p className="eyebrow">MY_WORDS</p>{editing ? <VisibilityControl blockId="MY_WORDS" checked={form.publicBlockIds.includes("MY_WORDS")} onChange={(value) => togglePublicBlock("MY_WORDS", value)} /> : <span className={`profile-privacy ${profile.settings.publicBlockIds.includes("MY_WORDS") ? "public" : "private"}`}>{profile.settings.publicBlockIds.includes("MY_WORDS") ? "公开" : "私密"}</span>}</div>
          <h2>我怎么说这一口</h2>
          {editing ? (
            <div className="stack">
              <label className="field-label">原话来源
                <select className="profile-input" value={form.sourceFeedbackId} onChange={(event) => {
                  const source = profile.quoteCandidates.find((item) => item.feedbackId === event.target.value);
                  setForm({ ...form, sourceFeedbackId: event.target.value, publicQuote: source?.text.slice(0, 120) || "" });
                }}>
                  <option value="">暂不选择</option>
                  {profile.quoteCandidates.map((candidate) => <option key={candidate.feedbackId} value={candidate.feedbackId}>{candidate.tea.name} · {candidate.text}</option>)}
                </select>
              </label>
              <label className="field-label">公开版本（不会修改原始反馈）<textarea className="profile-input profile-textarea" maxLength={120} disabled={!form.sourceFeedbackId} value={form.publicQuote} onChange={(event) => setForm({ ...form, publicQuote: event.target.value })} /></label>
              <small className="muted">{form.publicQuote.length} / 120 字</small>
            </div>
          ) : profile.settings.publicQuote && selectedQuote ? (
            <blockquote>“{profile.settings.publicQuote}”<footer>{selectedQuote.tea.name} · {selectedQuote.normalizedTags.join(" / ") || "自己的话"}</footer></blockquote>
          ) : <p className="profile-empty-copy">只有你确认保存过的品饮原话，才能成为这里的来源。</p>}
        </article>

        <article className="profile-block passport-block">
          <div className="profile-block-head"><p className="eyebrow">TEA_PASSPORT</p>{editing ? <VisibilityControl blockId="TEA_PASSPORT" checked={form.publicBlockIds.includes("TEA_PASSPORT")} onChange={(value) => togglePublicBlock("TEA_PASSPORT", value)} /> : <span className={`profile-privacy ${profile.settings.publicBlockIds.includes("TEA_PASSPORT") ? "public" : "private"}`}>{profile.settings.publicBlockIds.includes("TEA_PASSPORT") ? "公开" : "私密"}</span>}</div>
          <h2>茶护照</h2>
          <div className="profile-passport-counts"><div><strong>{passport.length}</strong><span>款茶</span></div><div><strong>{passport.filter((item) => item.tasted).length}</strong><span>品过</span></div><div><strong>{passport.reduce((count, item) => count + (item.specimens || []).length, 0)}</strong><span>标本</span></div></div>
          {passport.length ? <div className="profile-passport-teas">{passport.map((item) => <span key={item.tea.teaId}>{item.tea.name}{item.realmUnlocked ? " · 白毫" : ""}</span>)}</div> : <p className="profile-empty-copy">喝过、收藏或完成茶境后，足迹会来到这里。</p>}
          <Link className="profile-inline-link" href="/passport">查看完整茶护照 <ArrowRight size={15} /></Link>
        </article>
      </div>

      {editing ? <button className="button primary block profile-save" disabled={busy} onClick={() => void saveProfile()}>保存四个 Block</button> : null}
      {!editing ? <section className="profile-loop-next"><p className="eyebrow">Next Tea</p><h2>{profile.teaBti.state === "forming" ? "再留下几次真实选择。" : "身份会随着下一杯继续生长。"}</h2><Link className="button primary block" href="/">继续刷茶，让它更清晰 <ArrowRight size={17} /></Link></section> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {notice ? <p className="profile-notice" aria-live="polite">{notice}</p> : null}

      <section className="profile-share-entry">
        <div><p className="eyebrow">Unlisted Share</p><h2>{profile.share.active ? "分享链接正在生效" : "只分享你选中的部分"}</h2><p>链接不可枚举，可随时撤销；公开页始终读取你现在保存的内容。</p></div>
        <button className="button warm block" disabled={editing} onClick={() => setShareOpen(true)}><ShareNetwork size={18} />{profile.share.active ? "管理分享" : "预览并分享"}</button>
        {editing ? <small>请先保存公开范围，再生成分享链接。</small> : null}
      </section>

      {shareOpen ? (
        <div className="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
          <button className="share-sheet-backdrop" aria-label="关闭分享面板" onClick={() => setShareOpen(false)} />
          <section className="share-sheet-panel">
            <div className="profile-block-head"><div><p className="eyebrow">Share Preview</p><h2 id="share-title">公开后的样子</h2></div><button className="share-close" aria-label="关闭" onClick={() => setShareOpen(false)}><X size={20} /></button></div>
            <article className="profile-share-card" data-testid="profile-share-preview">
              <p className="eyebrow">Tea-BTI · Tea Profile</p>
              <h3>{profile.settings.displayName}</h3>
              <p>{profile.settings.bio || "Tea-BTI 不是测出来的，是喝出来的。"}</p>
              <strong>{profile.teaBti.personaName || "正在形成"}{profile.teaBti.code ? ` · ${profile.teaBti.code}` : ""}</strong>
              {profile.settings.publicBlockIds.includes("MY_TEA") && selectedTea ? <span>本命茶 · {selectedTea.name}</span> : null}
              {profile.settings.publicBlockIds.includes("MY_WORDS") && profile.settings.publicQuote ? <blockquote>“{profile.settings.publicQuote}”</blockquote> : null}
              {profile.settings.publicBlockIds.includes("TEA_PASSPORT") ? <span>茶护照 · {passport.length} 款茶 · {passport.reduce((count, item) => count + (item.specimens || []).length, 0)} 件标本</span> : null}
            </article>
            <div className="share-public-list"><strong>这次会公开</strong>{publicBlockLabels.map((label) => <span key={label}><Check size={13} weight="bold" />{label}</span>)}</div>
            {profile.share.active ? (
              <>
                <div className="profile-qr">{qrDataUrl ? <img src={qrDataUrl} alt="公开茶主页二维码" /> : <span><QrCode size={28} />正在生成二维码…</span>}<div><strong>扫码看公开主页</strong><a href={publicUrl}>{publicUrl}</a></div></div>
                <div className="button-row"><button className="button primary" onClick={() => void systemShare()}><ShareNetwork size={17} />系统分享</button><button className="button" onClick={() => void copyLink()}><Copy size={17} />复制链接</button></div>
                <button className="button danger block" disabled={busy} onClick={() => void revokeShare()}><Trash size={17} />撤销并让旧链接失效</button>
              </>
            ) : <button className="button primary block" disabled={busy} onClick={() => void createShare()}><ShareNetwork size={18} />确认公开并生成链接</button>}
          </section>
        </div>
      ) : null}
    </section>
  );
}
