"use client";

import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, BookOpenText, CheckCircle, Leaf } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";

import { authenticated, jsonBody } from "@/lib/api";
import type { RealmComplete, RealmDetail } from "@/lib/api";

function readingEventId() {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `realm-reading-${suffix}`;
}

export function RealmStoryView({ realmId, detail, exitHref, onBack, onCompleted }: {
  realmId: string;
  detail: RealmDetail;
  exitHref: string;
  onBack: () => void;
  onCompleted: (completion: RealmComplete) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(Date.now());
  const evidence = useMemo(() => new Map(detail.definition.evidenceRefs.map((item) => [item.id, item])), [detail]);
  const alreadyRead = Boolean(detail.progress.readingCompletedAt);

  async function confirmReading() {
    if (busy || alreadyRead) return;
    setBusy(true); setError("");
    try {
      const response = await authenticated<RealmComplete>(`/realms/${realmId}/reading/complete`, {
        method: "POST",
        ...jsonBody({ clientEventId: readingEventId(), confirmed: true, totalElapsedMs: Date.now() - startedAt.current }),
      });
      onCompleted(response);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <main className="realm-story-page">
      <header className="realm-story-header">
        <button aria-label="返回茶境封面" onClick={onBack}><ArrowLeft size={20} /></button>
        <Link href={exitHref}>退出茶境</Link>
      </header>
      <section className="realm-story-hero">
        <BookOpenText size={30} weight="duotone" />
        <p className="eyebrow">完整文字稿 · {detail.definition.regionLabel}</p>
        <h1>{detail.definition.story.title}</h1>
        <p>{detail.definition.story.intro}</p>
        <small>约 {detail.definition.story.estimatedMinutes} 分钟 · 事实资料与互动隐喻分别标注</small>
      </section>

      <div className="realm-story-chapters">
        {detail.definition.story.chapters.map((chapter, index) => {
          const refs = (chapter.evidenceRefIds || []).map((id) => evidence.get(id)).filter(Boolean);
          const label = chapter.kind === "fact" ? "事实资料" : chapter.kind === "boundary" ? "体验边界" : "互动隐喻 + 事实";
          return (
            <article key={chapter.id} className="realm-story-chapter">
              <span className="realm-story-number">{String(index + 1).padStart(2, "0")}</span>
              <p className="eyebrow">{chapter.eyebrow}</p>
              <h2>{chapter.title}</h2>
              <span className={`realm-story-kind ${chapter.kind}`}>{label}</span>
              <p>{chapter.body}</p>
              {refs.length ? <div className="realm-story-sources">
                {refs.map((ref) => ref?.url ? <a key={ref.id} href={ref.url} target="_blank" rel="noreferrer">{ref.label}<ArrowSquareOut size={13} /></a> : null)}
              </div> : null}
            </article>
          );
        })}
      </div>

      <section className="realm-story-finish">
        <Leaf size={38} weight="duotone" />
        <p className="eyebrow">读完这一芽的来路</p>
        <h2>把理解收进茶护照</h2>
        <p>确认后会点亮黔南并领取同一枚“白毫”标本。文字稿使用默认叙事结果；以后完成互动，会换成你的行为结局。</p>
        {alreadyRead ? <Link className="button primary block" href="/passport"><CheckCircle size={18} /> 已读完，查看茶护照</Link> : <button className="button primary block" disabled={busy} onClick={() => void confirmReading()}>{busy ? "正在收下白毫…" : "我已经读完，收下白毫"}</button>}
        {error ? <div className="error" role="alert">{error}<button className="button" onClick={() => void confirmReading()}>再试一次</button></div> : null}
      </section>
    </main>
  );
}
