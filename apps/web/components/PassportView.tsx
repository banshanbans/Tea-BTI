"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle, Leaf } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { authenticated, mediaUrl } from "@/lib/api";
import type { Passport } from "@/lib/api";
import { COMMON_COPY } from "@/lib/copy";
import { teaDetailHref } from "@/lib/navigation";

export function PassportView() {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void authenticated<Passport>("/me/passport").then(setPassport).catch(() => setError("茶护照暂时没翻开。")); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!passport) return <div className="empty">{COMMON_COPY.loadingPassport}</div>;
  return (
    <section className="passport-page">
      <div className="passport-heading"><span><BookOpen size={25} weight="duotone" /></span><div><p className="eyebrow">喝过的，都在这里</p><h1 className="title">茶护照</h1></div></div><p className="subtitle">每一杯，都留下一点自己的痕迹。</p>
      <div className="stack" style={{ marginTop: 22 }}>
        {passport.items.length ? passport.items.map((entry) => (
          <article className="passport-entry" key={entry.tea.teaId}>
            <Link className="seed-card" href={teaDetailHref(entry.tea.teaId, "passport")}>
              <img src={mediaUrl(entry.tea.visual.url)} alt={entry.tea.name} />
              <div><span className="eyebrow">{entry.tea.region}</span><h3>{entry.tea.name}</h3><p>{entry.userDescription ? `“${entry.userDescription}”` : "还没有留下自己的描述"}</p><p className="passport-badges">{[entry.brewed && "已泡过", entry.tasted && "已品过", entry.saved && "已收藏", entry.realmCompletedAt && "已完成茶境"].filter(Boolean).map((label) => <span key={String(label)}><CheckCircle size={12} weight="fill" />{label}</span>)}</p></div>
            </Link>
            {entry.specimens?.length ? <div className="passport-specimens">{entry.specimens.map((item) => <div key={item.specimenId}><img src={mediaUrl(item.asset.url)} alt={`${item.name}数字标本`} /><p><span className="eyebrow"><Leaf size={12} weight="fill" />茶境标本</span><strong>{item.name}</strong><small>{item.description}</small></p></div>)}</div> : null}
          </article>
        )) : <div className="panel empty">还没有记录。<br /><Link className="button primary" href="/">先去刷第一杯 <ArrowRight size={17} /></Link></div>}
      </div>
      {passport.items.length ? <section className="passport-next-actions">
        <p className="eyebrow">从一杯，长成轮廓</p><h2>喝过的茶，正在拼出你的 Tea-BTI。</h2>
        <Link className="button primary block" href="/profile">看看我的 Tea-BTI <ArrowRight size={17} /></Link>
        <Link className="button block" href="/">继续刷下一杯</Link>
      </section> : null}
    </section>
  );
}
