"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, MapPin, Mountains } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { authenticated, mediaUrl } from "@/lib/api";
import type { RealmList } from "@/lib/api";

export function RealmHome() {
  const [realms, setRealms] = useState<RealmList | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void authenticated<RealmList>("/realms").then(setRealms).catch((cause) => setError((cause as Error).message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!realms) return <div className="empty">正在穿过黔南的雾…</div>;

  const realm = realms.items[0];
  if (!realm) return <div className="empty">还没有可进入的茶境。</div>;
  const completed = realm.progress.status === "completed";
  const inProgress = realm.progress.status === "in_progress";
  const action = completed ? "再走一遍" : inProgress ? "继续体验" : "进入茶境";

  return (
    <section className="realm-home-page">
      <p className="eyebrow">Tea Realm · 文化沉浸</p>
      <h1 className="title">从杯中这一口，<br />回到雾里的一芽。</h1>
      <p className="subtitle">不是文章，也不是游戏。用不到一分钟，亲手经过一片叶子的关键选择。</p>

      <div className={`realm-region-status ${realms.litRegionIds.includes(realm.regionId) ? "lit" : ""}`} aria-label="茶境地图">
        <span className="realm-region-icon">{completed ? <CheckCircle size={28} weight="duotone" /> : <MapPin size={28} weight="duotone" />}</span>
        <span><small>贵州茶脉 · 当前区域</small><strong>{realm.regionLabel}</strong></span>
        <em>{completed ? "已点亮" : "等你点亮"}</em>
      </div>

      <article className="realm-home-card">
        <img src={mediaUrl(realm.heroAsset.url)} alt="风格化黔南山雾氛围" />
        <div className="realm-home-shade" />
        <div className="realm-home-copy">
          <span className="realm-kicker"><Mountains size={15} weight="fill" />01 · {realm.regionLabel}</span>
          <h2>{realm.title}</h2>
          <p>{realm.subtitle}</p>
          <div className="realm-progress-line"><span style={{ width: `${realm.progress.completedScenes.length / 7 * 100}%` }} /></div>
          <div className="realm-home-meta">
            <span>{completed ? "7 / 7 幕完成" : `${realm.progress.completedScenes.length} / 7 幕`}</span>
            <span>{realm.specimen ? "白毫标本 · 已收藏" : "约 55 秒"}</span>
          </div>
          <Link className="button primary block" href={`/realm/${realm.realmId}${completed ? "?replay=1" : ""}`}>{action} <ArrowRight size={18} /></Link>
        </div>
      </article>

      {realm.specimen ? (
        <section className="panel specimen-preview">
          <img src={mediaUrl(realm.specimen.asset.url)} alt="白毫数字标本" />
          <div><p className="eyebrow">Passport Specimen</p><h2>白毫</h2><p className="muted">{realm.specimen.description}</p></div>
        </section>
      ) : null}
    </section>
  );
}
