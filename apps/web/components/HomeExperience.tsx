"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookmarkSimple, CaretLeft, CaretRight, CircleNotch, Eye, Heart, Leaf, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { components } from "@tea-bti/contracts";

import { AppShell } from "@/components/AppShell";
import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { BlindCard, Bootstrap, Recommendation, SeedBatch, SwipeResult, TeaSummary } from "@/lib/api";
import { useAppStore } from "@/lib/store";

type MbtiCode = components["schemas"]["MbtiCode"];
type Screen = "launch" | "mbti" | "seeds" | "feed" | "reveal" | "recommendation";
type LandingScreen = "mbti" | "feed";
const LAUNCH_SEEN_KEY = "tea-bti.launchSeen";
const RETURNING_LAUNCH_MS = 800;

const MBTI: MbtiCode[] = ["INFP", "INFJ", "ENFP", "ENFJ", "INTP", "INTJ", "ENTP", "ENTJ", "ISFP", "ISFJ", "ESFP", "ESFJ", "ISTP", "ISTJ", "ESTP", "ESTJ"];

function BlindTeaCard({ card, depth = 0 }: { card: BlindCard; depth?: number }) {
  return (
    <article className={`tea-card deck-card depth-${depth}`} aria-hidden={depth > 0}>
      <img src={mediaUrl(card.visual.url)} style={{ objectPosition: card.visual.objectPosition }} alt={depth ? "" : "一杯茶的氛围视觉"} />
      <div className="card-content">
        <p className="card-kicker">先感觉，后认识</p>
        <h1>{card.headline}</h1>
        <p>{card.body}</p>
        <div className="tags">{card.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <p className="card-scene">{card.scene.startsWith("适合") ? card.scene : `适合 ${card.scene}`}</p>
      </div>
    </article>
  );
}

export function HomeExperience({ forceOnboarding = false }: { forceOnboarding?: boolean }) {
  const [screen, setScreen] = useState<Screen>("launch");
  const [landing, setLanding] = useState<LandingScreen>("mbti");
  const [launchReady, setLaunchReady] = useState(false);
  const [launchSeen, setLaunchSeen] = useState(false);
  const [launchPreferenceReady, setLaunchPreferenceReady] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [seeds, setSeeds] = useState<SeedBatch | null>(null);
  const [cards, setCards] = useState<BlindCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [reveal, setReveal] = useState<TeaSummary | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seedIndex, setSeedIndex] = useState(0);
  const [seedExpanded, setSeedExpanded] = useState(false);
  const launchStartedAt = useRef(Date.now());
  const { swipeCount, setBootstrap, incrementSwipe } = useAppStore();

  const loadFeed = useCallback(async (activate = true) => {
    const feed = await authenticated<{ items: BlindCard[] }>("/feed?limit=6");
    setCards(feed.items);
    setCardIndex(0);
    if (activate) setScreen("feed");
  }, []);

  useEffect(() => {
    setLaunchSeen(window.localStorage.getItem(LAUNCH_SEEN_KEY) === "1");
    setLaunchPreferenceReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLaunchReady(false);
    setError("");
    void (async () => {
      try {
        const bootstrap = await authenticated<Bootstrap>("/bootstrap");
        if (cancelled) return;
        setBootstrap(bootstrap.swipeCount, bootstrap.mbti ?? null);
        if (forceOnboarding || !bootstrap.onboardingCompleted) setLanding("mbti");
        else {
          await loadFeed(false);
          if (!cancelled) setLanding("feed");
        }
      } catch (cause) {
        if (!cancelled) {
          setError((cause as Error).message);
          setLanding("mbti");
        }
      } finally {
        if (!cancelled) setLaunchReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [bootstrapAttempt, forceOnboarding, loadFeed, setBootstrap]);

  useEffect(() => {
    if (!launchPreferenceReady || !launchSeen || !launchReady || error || screen !== "launch") return;
    const elapsed = Date.now() - launchStartedAt.current;
    const timeout = window.setTimeout(() => setScreen(landing), Math.max(0, RETURNING_LAUNCH_MS - elapsed));
    return () => window.clearTimeout(timeout);
  }, [error, landing, launchPreferenceReady, launchReady, launchSeen, screen]);

  function enterExperience() {
    window.localStorage.setItem(LAUNCH_SEEN_KEY, "1");
    setLaunchSeen(true);
    setScreen(landing);
  }

  async function chooseMbti(mbti: MbtiCode | null) {
    setBusy(true); setError("");
    try {
      const result = await authenticated<SeedBatch>("/onboarding/seed", { method: "POST", ...jsonBody({ mbti }) });
      setSeeds(result); setSeedIndex(0); setSeedExpanded(false); setScreen("seeds");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function swipe(action: "like" | "skip" | "save") {
    const card = cards[cardIndex];
    if (!card || busy) return;
    setBusy(true); setError("");
    try {
      const result = await authenticated<SwipeResult>("/swipes", {
        method: "POST",
        ...jsonBody({ clientEventId: crypto.randomUUID(), cardId: card.cardId, action }),
      });
      if (result.accepted) incrementSwipe();
      setRecommendation(result.recommendation ?? null);
      if (result.reveal) { setReveal(result.reveal); setScreen("reveal"); }
      else if (result.recommendation) setScreen("recommendation");
      else setCardIndex((index) => (index + 1) % cards.length);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  function continueAfterReveal() {
    if (recommendation) setScreen("recommendation");
    else { setCardIndex((index) => (index + 1) % cards.length); setScreen("feed"); }
  }

  const deck = useMemo(() => {
    if (!cards.length) return [];
    return [0, 1, 2].map((depth) => ({ card: cards[(cardIndex + depth) % cards.length], depth }));
  }, [cardIndex, cards]);

  if (screen === "launch") return (
    <AppShell active="swipe" navigation={false} header={false} shellClassName="launch-shell"><section className="launch-screen" aria-busy={!launchReady}>
      <div className="launch-glow" aria-hidden="true" />
      <header className="launch-brand">
        <span className="launch-mark"><Leaf size={26} weight="fill" /></span>
        <span><strong>Tea-BTI</strong><small>GUIZHOU TEA IDENTITY</small></span>
      </header>
      <div className="launch-copy">
        <p className="eyebrow">从一杯感觉，长出你的茶味身份</p>
        <h1>你不用先懂茶。<br />刷几下，<em>茶先开始懂你。</em></h1>
        <p>MBTI 只负责破冰。真正留下来的，是你每一次想喝、跳过和真实品饮。</p>
        {error ? <><p className="launch-error" role="alert">暂时没能准备好茶席：{error}</p><button className="button primary launch-cta" onClick={() => setBootstrapAttempt((attempt) => attempt + 1)}>重新准备 <ArrowRight size={19} weight="bold" /></button></> : launchSeen ? <div className="launch-resume" aria-live="polite"><CircleNotch className="spin" size={19} />正在恢复上次进度</div> : <button className="button primary launch-cta" disabled={!launchReady || !launchPreferenceReady} onClick={enterExperience}>
          {launchReady && launchPreferenceReady ? <>开始刷茶 <ArrowRight size={19} weight="bold" /></> : <><CircleNotch className="spin" size={19} />正在准备茶席</>}
        </button>}
        <small className="launch-note">无需注册 · 已有记录会自动恢复</small>
      </div>
    </section></AppShell>
  );

  if (screen === "mbti") return (
    <AppShell active="swipe" navigation={false} header={false} shellClassName="cold-start-shell"><section className="onboarding-screen cold-start-screen">
      <div className="cold-start-head"><span className="brand">Tea-BTI</span><span>1 / 2</span></div>
      <p className="eyebrow">Cold Start · 从三杯开始</p>
      <h1 className="title">你的 MBTI，<br />会喝什么茶？</h1>
      <p className="subtitle">{forceOnboarding ? "从朋友的茶主页来到这里，不会清空你原来的记录。MBTI 只负责重新破冰。" : "它不决定你的口味，只帮你推开第一扇门。真正懂你的，是接下来的每一次选择。"}</p>
      <div className="mbti-grid">
        {MBTI.map((code) => <button disabled={busy} className="mbti-button" key={code} onClick={() => chooseMbti(code)}>{code}</button>)}
      </div>
      <button disabled={busy} className="button block" onClick={() => chooseMbti(null)}>不知道？先刷再说</button>
      {error ? <p className="error">{error}</p> : null}
    </section></AppShell>
  );

  if (screen === "seeds" && seeds) {
    const item = seeds.items[seedIndex];
    return (
      <AppShell active="swipe" navigation={false} header={false} shellClassName="cold-start-shell"><section className="seed-screen cold-start-screen">
        <div className="cold-start-head"><span className="brand">Tea-BTI</span><span>2 / 2</span></div>
        <p className="eyebrow">{seeds.mbti ? `${seeds.mbti} 的第一批三杯` : "探索型三杯"}</p>
        <h1 className="section-title">这三杯只是起点。</h1>
        <p className="subtitle">看看哪杯让你想靠近，再用真实选择把推荐校准。</p>
        <div className="seed-carousel" aria-label="三杯破冰结果">
          <article className="seed-focus-card" key={item.role}>
            <img src={mediaUrl(item.visual.url)} style={{ objectPosition: item.visual.objectPosition }} alt={item.name} />
            <div className="seed-focus-copy"><span className="eyebrow">{item.roleLabel}</span><h2>{item.name}</h2><p>{item.explanation}</p>
              {seedExpanded ? <div className="seed-more"><div className="tags light-tags">{item.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><small>这是破冰解释，不会写入你的 Taste Vector。</small></div> : null}
              <button className="seed-peek" aria-expanded={seedExpanded} onClick={() => setSeedExpanded((expanded) => !expanded)}><Eye size={16} />{seedExpanded ? "收起" : "先看看"}</button>
            </div>
          </article>
          <div className="seed-carousel-controls">
            <button aria-label="上一杯" disabled={seedIndex === 0} onClick={() => { setSeedIndex((index) => index - 1); setSeedExpanded(false); }}><CaretLeft size={18} /></button>
            <div className="seed-dots" aria-label={`第 ${seedIndex + 1} 杯，共 ${seeds.items.length} 杯`}>{seeds.items.map((seed, index) => <button key={seed.role} aria-label={`查看第 ${index + 1} 杯`} className={index === seedIndex ? "active" : ""} onClick={() => { setSeedIndex(index); setSeedExpanded(false); }} />)}</div>
            <button aria-label="下一杯" disabled={seedIndex === seeds.items.length - 1} onClick={() => { setSeedIndex((index) => index + 1); setSeedExpanded(false); }}><CaretRight size={18} /></button>
          </div>
        </div>
        <button className="button primary block seed-primary" onClick={() => void loadFeed()}>开始刷茶，让推荐变准 <ArrowRight size={18} /></button>
        <small className="seed-disclaimer">MBTI 只负责破冰，真正留下来的是接下来的每一次选择。</small>
      </section></AppShell>
    );
  }

  if (screen === "reveal" && reveal) return (
    <AppShell active="swipe"><section className="sheet-screen" role="dialog" aria-label="喜欢的茶已揭晓">
      <div className="sheet-backdrop" />
      <motion.article initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="bottom-sheet reveal-sheet">
        <span className="sheet-grabber" />
        <img className="reveal-image" src={mediaUrl(reveal.visual.url)} style={{ objectPosition: reveal.visual.objectPosition }} alt={reveal.name} />
        <div><p className="eyebrow">你刚刚喜欢的是</p><h1 className="title">{reveal.name}</h1><p className="muted">{reveal.region} · {reveal.teaType}</p></div>
        <div className="tags light-tags">{reveal.professionalTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <p className="translation-card"><span>译</span>{reveal.translation}</p>
        <div className="button-row"><button className="button" onClick={continueAfterReveal}>继续刷</button><Link className="button primary" href={`/tea/${reveal.teaId}`}>看看这杯 <ArrowRight size={17} /></Link></div>
      </motion.article>
    </section></AppShell>
  );

  if (screen === "recommendation" && recommendation) return (
    <AppShell active="swipe"><section className="recommendation-screen">
      <p className="eyebrow">Recommendation · {swipeCount} 次真实选择</p>
      <h1 className="title">我开始<br />有点懂你了。</h1>
      <article className="recommendation-card">
        <img src={mediaUrl(recommendation.tea.visual.url)} alt={recommendation.tea.name} />
        <div><small>目前最想让你试的一杯</small><h2>{recommendation.tea.name}</h2><p>{recommendation.tea.region}</p></div>
      </article>
      <div className="recommendation-reasons">{recommendation.reasons.map((reason) => <p key={reason}><Leaf size={15} weight="fill" />{reason}</p>)}</div>
      <Link className="button primary block" href={`/tea/${recommendation.tea.teaId}`}>喝这杯 <ArrowRight size={18} /></Link>
      <button className="button block" onClick={() => { setRecommendation(null); setCardIndex((index) => (index + 1) % cards.length); setScreen("feed"); }}>继续刷</button>
    </section></AppShell>
  );

  const card = cards[cardIndex];
  return card ? (
    <AppShell active="swipe"><section className="feed-screen">
      <div className="feed-head"><div><p className="eyebrow">Blind Swipe</p><h1>刷茶</h1></div><span className="status-pill">{swipeCount + 1} 次选择</span></div>
      <p className="feed-hint">先凭感觉。喜欢之后，才告诉你它是谁。</p>
      <div className="swipe-deck">
        {[...deck].reverse().map(({ card: deckCard, depth }) => depth === 0 ? (
          <motion.div key={`${deckCard.cardId}-${depth}`} className="deck-motion" drag="x" dragElastic={0.7} whileDrag={{ rotate: 4 }} onDragEnd={(_, info) => {
            if (info.offset.x > 90) void swipe("like");
            else if (info.offset.x < -90) void swipe("skip");
          }}><BlindTeaCard card={deckCard} depth={depth} /></motion.div>
        ) : <BlindTeaCard key={`${deckCard.cardId}-${depth}`} card={deckCard} depth={depth} />)}
      </div>
      <div className="swipe-actions">
        <button disabled={busy} className="swipe-action skip" aria-label="下一杯" onClick={() => void swipe("skip")}><X size={26} weight="bold" /><span>下一杯</span></button>
        <button disabled={busy} className="swipe-action save" aria-label="先收藏" onClick={() => void swipe("save")}><BookmarkSimple size={23} weight="bold" /><span>收藏</span></button>
        <button disabled={busy} className="swipe-action like" aria-label="想喝" onClick={() => void swipe("like")}><Heart size={27} weight="fill" /><span>想喝</span></button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section></AppShell>
  ) : <AppShell active="swipe"><div className="empty"><button className="button" onClick={() => void loadFeed()}>重新装一组卡片</button></div></AppShell>;
}
