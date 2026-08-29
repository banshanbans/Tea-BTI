"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, MapPin, Mountains } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { authenticated, mediaUrl } from "@/lib/api";
import type { RealmList } from "@/lib/api";
import { COMMON_COPY } from "@/lib/copy";

const reveal = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export function RealmHome() {
  const [realms, setRealms] = useState<RealmList | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void authenticated<RealmList>("/realms").then(setRealms).catch(() => setError("雾里的路暂时没亮。"));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!realms) return <div className="empty">{COMMON_COPY.loadingRealm}</div>;

  const realm = realms.items[0];
  if (!realm) return <div className="empty">还没有可进入的茶境。</div>;
  const completed = realm.progress.status === "completed";
  const inProgress = realm.progress.status === "in_progress";
  const completedScenes = realm.progress.completedScenes.length;
  const progressPercent = Math.round(completedScenes / 7 * 100);
  const action = completed ? "再走一遍" : inProgress ? "继续体验" : "进入茶境";
  const realmHref = `/realm/${realm.realmId}?entry=realm${completed ? "&replay=1" : ""}`;

  return (
    <motion.section className="realm-home-page" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}>
      <motion.p className="eyebrow" variants={reveal}>杯中的茶境</motion.p>
      <motion.h1 className="title" variants={reveal}>从杯中这一口，<br />回到雾里的一芽。</motion.h1>
      <motion.p className="subtitle" variants={reveal}>用 70–100 秒，把手机变成制茶工具，跟着一片嫩叶走进黔南的雾。</motion.p>

      <motion.div className={`realm-region-status ${realms.litRegionIds.includes(realm.regionId) ? "lit" : ""}`} aria-label="茶境地图" variants={reveal}>
        <span className="realm-region-icon">{completed ? <CheckCircle size={28} weight="duotone" /> : <MapPin size={28} weight="duotone" />}</span>
        <span><small>贵州茶脉 · 当前区域</small><strong>{realm.regionLabel}</strong></span>
        <em>{completed ? "已点亮" : "等你点亮"}</em>
      </motion.div>

      <motion.article className="realm-home-card" variants={{ hidden: { opacity: 0, y: 18, scale: 0.985 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6 } } }}>
        <img src={mediaUrl(realm.heroAsset.url)} alt="风格化黔南山雾氛围" />
        <div className="realm-home-shade" />
        <div className="realm-home-copy">
          <span className="realm-kicker"><Mountains size={15} weight="fill" />01 · {realm.regionLabel}</span>
          <h2>{realm.title}</h2>
          <p>{realm.subtitle}</p>
          <div className="realm-progress-line"><span style={{ width: `${progressPercent}%` }} /></div>
          <div className="realm-home-meta">
            <span>{completed ? "7 / 7 幕完成" : `${completedScenes} / 7 幕 · ${progressPercent}%`}</span>
            <span>{realm.specimen ? "白毫标本 · 已收藏" : "约 70–100 秒"}</span>
          </div>
          {realm.outcome ? <div className="realm-home-outcome"><strong>{realm.outcome.title}</strong><span>{realm.outcome.summary}</span><small>{realm.outcome.disclaimer}</small></div> : null}
          <Link className="button primary block" href={realmHref}>{action} <ArrowRight size={18} /></Link>
        </div>
      </motion.article>

      {realm.specimen ? (
        <motion.section className="panel specimen-preview" variants={reveal}>
          <div className="specimen-preview-img"><img src={mediaUrl(realm.specimen.asset.url)} alt="白毫数字标本" /><span aria-hidden="true" /></div>
          <div><p className="eyebrow">茶境标本</p><h2>白毫</h2><p className="muted">{realm.specimen.description}</p></div>
        </motion.section>
      ) : null}
    </motion.section>
  );
}
