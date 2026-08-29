"use client";

import Link from "next/link";
import { ArrowRight, BookmarkSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { BackControl } from "@/components/BackControl";
import { authenticated, mediaUrl } from "@/lib/api";
import type { Passport } from "@/lib/api";
import { COMMON_COPY } from "@/lib/copy";
import { teaDetailHref } from "@/lib/navigation";

export function SavedTeaView() {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void authenticated<Passport>("/me/passport").then(setPassport).catch(() => setError("收藏夹暂时没打开。"));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!passport) return <div className="empty">{COMMON_COPY.loadingPassport}</div>;
  const saved = passport.items.filter((entry) => entry.saved);

  return (
    <section className="passport-page saved-tea-page">
      <header className="saved-tea-heading">
        <BackControl href="/profile" ariaLabel="返回我的" />
        <span><BookmarkSimple size={25} weight="fill" /></span>
        <div><p className="eyebrow">想喝的，先放在这里</p><h1 className="title">我的收藏</h1></div>
      </header>
      <p className="subtitle">共 {saved.length} 款茶，点开就能继续泡、品或进入茶境。</p>
      <div className="stack" style={{ marginTop: 22 }}>
        {saved.length ? saved.map((entry) => (
          <Link className="passport-entry seed-card saved-tea-card" href={teaDetailHref(entry.tea.teaId, "profile")} key={entry.tea.teaId}>
            <img src={mediaUrl(entry.tea.visual.url)} alt={entry.tea.name} />
            <div><span className="eyebrow">{entry.tea.region} · {entry.tea.teaType}</span><h3>{entry.tea.name}</h3><p>{entry.tea.translation}</p></div>
            <ArrowRight size={18} />
          </Link>
        )) : <div className="panel empty">还没有收藏。<br /><Link className="button primary" href="/">去刷茶看看 <ArrowRight size={17} /></Link></div>}
      </div>
    </section>
  );
}
