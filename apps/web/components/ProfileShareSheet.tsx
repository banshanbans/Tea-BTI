"use client";

import QRCode from "qrcode";
import { Copy, QrCode, ShareNetwork, Trash, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { authenticated, jsonBody } from "@/lib/api";
import type { ProfileBlockId, ProfileShareMutation, TeaProfile, TeaProfileMutation } from "@/lib/api";
import { eventId, PROFILE_BLOCK_LABELS, profileToForm, profileUpdateBody, togglePublicBlock } from "@/lib/profile";
import { ProfileVisibilityControls } from "./ProfileVisibilityControls";

function sameBlocks(left: ProfileBlockId[], right: ProfileBlockId[]): boolean {
  return left.length === right.length && left.every((blockId, index) => blockId === right[index]);
}

export function ProfileShareSheet({
  profile,
  onProfileChange,
  onClose,
}: {
  profile: TeaProfile;
  onProfileChange: (profile: TeaProfile) => void;
  onClose: () => void;
}) {
  const [shareBlockIds, setShareBlockIds] = useState<ProfileBlockId[]>(profile.settings.publicBlockIds);
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const publicUrl = profile.share.active && profile.share.publicPath && origin ? `${origin}${profile.share.publicPath}` : "";
  const shareDirty = !sameBlocks(shareBlockIds, profile.settings.publicBlockIds);
  const publicBlockLabels = useMemo(() => shareBlockIds.map((blockId) => PROFILE_BLOCK_LABELS[blockId]), [shareBlockIds]);
  const selectedTea = profile.selectedTea || null;
  const passport = profile.passport.items;
  const specimenCount = passport.reduce((count, item) => count + (item.specimens || []).length, 0);

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

  async function persistShareScope(): Promise<TeaProfile> {
    const form = { ...profileToForm(profile), publicBlockIds: shareBlockIds };
    const result = await authenticated<TeaProfileMutation>("/me/profile", {
      method: "PUT",
      ...jsonBody(profileUpdateBody(form, eventId("profile-share-scope"))),
    });
    onProfileChange(result.profile);
    setShareBlockIds(result.profile.settings.publicBlockIds);
    return result.profile;
  }

  async function saveShareScope() {
    setBusy(true); setError(""); setNotice("");
    try {
      await persistShareScope();
      setNotice("分享范围已更新");
    } catch {
      setError("分享范围还没收好，再试一次。");
    } finally {
      setBusy(false);
    }
  }

  async function createShare() {
    setBusy(true); setError(""); setNotice("");
    try {
      const currentProfile = shareDirty ? await persistShareScope() : profile;
      const result = await authenticated<ProfileShareMutation>("/me/profile/share", {
        method: "POST",
        ...jsonBody({ clientEventId: eventId("profile-share") }),
      });
      onProfileChange({ ...currentProfile, share: result.share });
      setNotice("新的分享链接已经亮起");
    } catch {
      setError("分享链接还没生成，再试一次。");
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
      setError("没能自动复制，长按链接也可以带走。");
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
        title: `${profile.settings.displayName || "一位喝茶的人"}的茶主页`,
        text: "来看看我喝出来的 Tea-BTI，也从三杯茶开始找你的那一杯。",
        url: publicUrl,
      });
      setNotice("分享面板已打开");
    } catch (cause) {
      if ((cause as DOMException).name !== "AbortError") setError("系统分享暂时没打开，复制链接也可以。");
    }
  }

  async function revokeShare() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authenticated<ProfileShareMutation>("/me/profile/share", {
        method: "DELETE",
        headers: { "X-Client-Event-Id": eventId("profile-revoke") },
      });
      onProfileChange({ ...profile, share: result.share });
      setNotice("旧链接已经收起");
    } catch {
      setError("链接还没收起，再试一次。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button className="share-sheet-backdrop" aria-label="关闭分享面板" onClick={onClose} />
      <section className="share-sheet-panel">
        <div className="profile-share-head"><div><p className="eyebrow">分享茶主页</p><h2 id="share-title">这次想分享什么</h2></div><button className="share-close" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>

        <ProfileVisibilityControls
          profile={profile}
          blockIds={shareBlockIds}
          onChange={(blockId, enabled) => setShareBlockIds(togglePublicBlock(shareBlockIds, blockId, enabled))}
        />

        <article className="profile-share-card" data-testid="profile-share-preview">
          <p className="eyebrow">Tea-BTI 茶主页</p>
          <h3>{profile.settings.displayName}</h3>
          <p>{profile.settings.bio || "一杯一杯，慢慢喝出自己的轮廓。"}</p>
          <strong>{profile.teaBti.personaName || "正在形成"}{profile.teaBti.code ? ` · ${profile.teaBti.code}` : ""}</strong>
          {profile.teaBti.personaSummary ? <span className="profile-share-persona-summary">{profile.teaBti.personaSummary}</span> : null}
          {shareBlockIds.includes("MY_TEA") && selectedTea ? <span>本命茶 · {selectedTea.name}</span> : null}
          {shareBlockIds.includes("MY_WORDS") && profile.settings.publicQuote ? <blockquote>“{profile.settings.publicQuote}”</blockquote> : null}
          {shareBlockIds.includes("TEA_PASSPORT") ? <span>茶护照 · {passport.length} 款茶 · {specimenCount} 件标本</span> : null}
        </article>

        <div className="share-public-list"><strong>这次会公开</strong>{publicBlockLabels.map((label) => <span key={label}>{label}</span>)}</div>

        {profile.share.active ? (
          <>
            {shareDirty ? <button className="button primary block" disabled={busy} onClick={() => void saveShareScope()}>更新分享范围</button> : null}
            <div className="profile-qr">{qrDataUrl ? <img src={qrDataUrl} alt="公开茶主页二维码" /> : <span><QrCode size={28} />正在生成二维码…</span>}<div><strong>扫码看公开主页</strong><a href={publicUrl}>{publicUrl}</a></div></div>
            <div className="button-row"><button className="button primary" onClick={() => void systemShare()}><ShareNetwork size={17} />系统分享</button><button className="button" onClick={() => void copyLink()}><Copy size={17} />复制链接</button></div>
            <button className="button danger block" disabled={busy} onClick={() => void revokeShare()}><Trash size={17} />撤销并让旧链接失效</button>
          </>
        ) : <button className="button primary block" disabled={busy} onClick={() => void createShare()}><ShareNetwork size={18} />确认范围并生成链接</button>}

        {error ? <p className="error" role="alert">{error}</p> : null}
        {notice ? <p className="profile-notice" aria-live="polite">{notice}</p> : null}
      </section>
    </div>
  );
}
