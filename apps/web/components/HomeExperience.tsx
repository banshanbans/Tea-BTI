"use client";

import Link from "next/link";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ArrowRight, BookmarkSimple, CaretLeft, CaretRight, Eye, Heart, Leaf, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { components } from "@tea-bti/contracts";

import { AppShell } from "@/components/AppShell";
import { BackControl } from "@/components/BackControl";
import { OnboardingChoiceDialog } from "@/components/onboarding/OnboardingChoiceDialog";
import { authenticated, jsonBody, mediaUrl } from "@/lib/api";
import type { Bootstrap, Recommendation, SeedBatch, SwipeResult, TeaFeedCard, TeaSummary } from "@/lib/api";
import { HOME_COPY, MBTI_OPTIONS } from "@/lib/copy";
import { teaDetailHref } from "@/lib/navigation";
import { useAppStore } from "@/lib/store";

type MbtiCode = components["schemas"]["MbtiCode"];
type Screen = "loading" | "mbti" | "seeds" | "feed" | "reveal" | "recommendation";
type MbtiAxisLetter = "E" | "I" | "N" | "S" | "T" | "F" | "J" | "P";
type MbtiAxisSelection = [MbtiAxisLetter, MbtiAxisLetter, MbtiAxisLetter, MbtiAxisLetter];
type TeaCardPreviewData = {
  name: string;
  imageUrl: string;
  eyebrow: string;
  description: string;
  tags: string[];
};
const SWIPE_THRESHOLD = 92;
const SEED_SWIPE_THRESHOLD = 74;
const MBTI_AXES = [
  { label: "能量", choices: ["E", "I"] },
  { label: "感知", choices: ["N", "S"] },
  { label: "决策", choices: ["T", "F"] },
  { label: "方式", choices: ["J", "P"] },
] as const;

function TeaSwipeCard({ card, depth = 0 }: { card: TeaFeedCard; depth?: number }) {
  return (
    <article className={`tea-card deck-card depth-${depth}`} aria-hidden={depth > 0}>
      <img className="presentation-art" src={mediaUrl(card.visual.url)} style={{ objectPosition: card.visual.objectPosition }} alt={depth ? "" : `${card.name}立体设计图`} />
      <div className="card-content">
        <p className="card-identity">{card.name} · {card.teaType}</p>
        <small className="card-region">{card.region}</small>
        <h1>{card.headline}</h1>
        <div className="card-personality">{card.personalityKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
      </div>
    </article>
  );
}

function TeaCardPreview({ card, onClose }: { card: TeaCardPreviewData; onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <section className="card-preview-layer" role="dialog" aria-modal="true" aria-label={`${card.name}完整茶叶卡`}>
      <button type="button" className="card-preview-backdrop" aria-label="轻触遮罩关闭完整茶叶卡" onClick={onClose} />
      <motion.article
        className="card-preview-dialog"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 310, damping: 28 }}
      >
        <button type="button" autoFocus className="card-preview-close" aria-label="关闭完整茶叶卡" onClick={onClose}><X size={21} /></button>
        <img src={card.imageUrl} alt={`${card.name}完整茶叶卡`} />
        <div className="card-preview-copy">
          <p className="eyebrow">{card.eyebrow}</p>
          <h2>{card.name}</h2>
          <p>{card.description}</p>
          <div className="card-preview-tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
      </motion.article>
    </section>
  );
}

function MbtiAxisWheel({ label, choices, value, disabled, onChange }: {
  label: string;
  choices: readonly [MbtiAxisLetter, MbtiAxisLetter];
  value: MbtiAxisLetter;
  disabled: boolean;
  onChange: (value: MbtiAxisLetter) => void;
}) {
  const wheel = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const selectedIndex = choices.indexOf(value);

  function centerChoice(index: number, behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth") {
    const item = wheel.current?.querySelector<HTMLElement>(`[data-axis-index="${index}"]`);
    if (!wheel.current || !item) return;
    onChange(choices[index]);
    const top = item.offsetTop - (wheel.current.clientHeight - item.clientHeight) / 2;
    if (typeof wheel.current.scrollTo === "function") wheel.current.scrollTo({ top, behavior });
    else wheel.current.scrollTop = top;
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => centerChoice(selectedIndex, "auto"));
    return () => window.cancelAnimationFrame(frame);
  // Centering follows the controlled selection; onChange is intentionally not a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  useEffect(() => () => {
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
  }, []);

  function updateFromScroll() {
    const node = wheel.current;
    if (!node) return;
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const center = node.scrollTop + node.clientHeight / 2;
      const items = [...node.querySelectorAll<HTMLElement>("[data-axis-index]")];
      const nearest = items.reduce((best, item) => {
        const distance = Math.abs(item.offsetTop + item.clientHeight / 2 - center);
        return distance < best.distance ? { index: Number(item.dataset.axisIndex), distance } : best;
      }, { index: selectedIndex, distance: Number.POSITIVE_INFINITY });
      onChange(choices[nearest.index]);
    }, 70);
  }

  return <div className="mbti-axis-group">
    <span className="mbti-axis-label">{label}</span>
    <div className="mbti-axis-shell">
      <span className="mbti-axis-focus" aria-hidden="true" />
      <div
        className="mbti-axis-wheel"
        ref={wheel}
        role="listbox"
        aria-label={`${label}维度`}
        tabIndex={0}
        onScroll={updateFromScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") { event.preventDefault(); centerChoice(Math.max(0, selectedIndex - 1)); }
          if (event.key === "ArrowDown") { event.preventDefault(); centerChoice(Math.min(choices.length - 1, selectedIndex + 1)); }
        }}
      >
        {choices.map((choice, index) => <button
          type="button"
          role="option"
          aria-selected={choice === value}
          className={`mbti-axis-option ${choice === value ? "selected" : ""}`}
          data-axis-index={index}
          disabled={disabled}
          key={choice}
          onClick={() => centerChoice(index)}
        >{choice}</button>)}
      </div>
    </div>
  </div>;
}

export function HomeExperience({ forceOnboarding = false }: { forceOnboarding?: boolean }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [seeds, setSeeds] = useState<SeedBatch | null>(null);
  const [cards, setCards] = useState<TeaFeedCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [reveal, setReveal] = useState<TeaSummary | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [seedIndex, setSeedIndex] = useState(0);
  const [seedTransitioning, setSeedTransitioning] = useState(false);
  const [cardPreview, setCardPreview] = useState<TeaCardPreviewData | null>(null);
  const [onboardingChoiceOpen, setOnboardingChoiceOpen] = useState(false);
  const [onboardingChoiceError, setOnboardingChoiceError] = useState("");
  const [mbtiAxes, setMbtiAxes] = useState<MbtiAxisSelection>(["I", "N", "F", "J"]);
  const seedTransitioningRef = useRef(false);
  const dragStartPointX = useRef<number | null>(null);
  const previewPointerStart = useRef<{ x: number; y: number } | null>(null);
  const previewDragged = useRef(false);
  const onboardingChoiceShownRef = useRef(false);
  const onboardingAlreadyCompletedRef = useRef(false);
  const mbtiScreenRef = useRef<HTMLElement>(null);
  const { swipeCount, setBootstrap, incrementSwipe } = useAppStore();
  const reducedMotion = useReducedMotion();
  const seedX = useMotionValue(0);
  const seedRotation = useTransform(seedX, [-240, 0, 240], [-7, 0, 7]);
  const seedScale = useTransform(seedX, (value) => 1 - Math.min(0.025, Math.abs(value) / 9000));
  const cardX = useMotionValue(0);
  const cardRotation = useTransform(cardX, [-220, 0, 220], [-11, 0, 11]);
  const liftProgress = useTransform(cardX, (value) => Math.min(1, Math.abs(value) / SWIPE_THRESHOLD));
  const secondY = useTransform(liftProgress, [0, 1], [12, 0]);
  const secondScale = useTransform(liftProgress, [0, 1], [0.965, 1]);
  const secondOpacity = useTransform(liftProgress, [0, 1], [0.76, 1]);
  const thirdY = useTransform(liftProgress, [0, 1], [24, 12]);
  const thirdScale = useTransform(liftProgress, [0, 1], [0.93, 0.965]);
  const thirdOpacity = useTransform(liftProgress, [0, 1], [0.42, 0.76]);
  const likeProgress = useTransform(cardX, (value) => Math.min(1, Math.max(0, value / SWIPE_THRESHOLD)));
  const skipProgress = useTransform(cardX, (value) => Math.min(1, Math.max(0, -value / SWIPE_THRESHOLD)));
  const likeScale = useTransform(likeProgress, [0, 1], [1, 1.24]);
  const skipScale = useTransform(skipProgress, [0, 1], [1, 1.2]);
  const likeOpacity = useTransform(cardX, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [0.42, 1, 1]);
  const skipOpacity = useTransform(cardX, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 1, 0.42]);
  const likeGlow = useTransform(likeProgress, (value) => `0 14px ${30 + value * 18}px rgba(70, 130, 72, ${0.25 + value * 0.35})`);
  const skipGlow = useTransform(skipProgress, (value) => `0 12px ${24 + value * 14}px rgba(113, 74, 61, ${0.12 + value * 0.28})`);

  const loadFeed = useCallback(async (activate = true) => {
    const feed = await authenticated<{ items: TeaFeedCard[] }>("/feed?limit=8");
    const resumeCardId = useAppStore.getState().feedResumeCardId;
    const resumeIndex = resumeCardId ? feed.items.findIndex((item) => item.cardId === resumeCardId) : -1;
    setCards(feed.items);
    setCardIndex(resumeIndex >= 0 ? resumeIndex : 0);
    if (activate) setScreen("feed");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBootstrapReady(false);
    setError("");
    void (async () => {
      try {
        const bootstrap = await authenticated<Bootstrap>("/bootstrap");
        if (cancelled) return;
        onboardingAlreadyCompletedRef.current = bootstrap.onboardingCompleted;
        setBootstrap(bootstrap.swipeCount, bootstrap.mbti ?? null);
        if (forceOnboarding || !bootstrap.onboardingCompleted) {
          setScreen("mbti");
          if (!onboardingChoiceShownRef.current) {
            onboardingChoiceShownRef.current = true;
            setOnboardingChoiceOpen(true);
          }
        } else {
          await loadFeed(false);
          if (!cancelled) setScreen("feed");
        }
      } catch {
        if (!cancelled) {
          setError(HOME_COPY.retryTitle);
          setScreen("mbti");
          if (!onboardingChoiceShownRef.current) {
            onboardingChoiceShownRef.current = true;
            setOnboardingChoiceOpen(true);
          }
        }
      } finally {
        if (!cancelled) setBootstrapReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [bootstrapAttempt, forceOnboarding, loadFeed, setBootstrap]);

  function setMbtiAxis(axisIndex: number, value: MbtiAxisLetter) {
    setMbtiAxes((current) => current.map((letter, index) => index === axisIndex ? value : letter) as MbtiAxisSelection);
  }

  function showSeed(index: number) {
    if (!seeds) return;
    setSeedIndex(Math.max(0, Math.min(seeds.items.length - 1, index)));
  }

  async function transitionSeed(targetIndex: number, direction: -1 | 1) {
    if (!seeds || seedTransitioningRef.current || targetIndex < 0 || targetIndex >= seeds.items.length) {
      await animate(seedX, 0, reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34 });
      return;
    }
    seedTransitioningRef.current = true;
    setSeedTransitioning(true);
    try {
      if (reducedMotion) {
        showSeed(targetIndex);
        seedX.set(0);
        return;
      }
      const exitX = direction === 1 ? -Math.max(480, window.innerWidth * 1.2) : Math.max(480, window.innerWidth * 1.2);
      await animate(seedX, exitX, { duration: 0.24, ease: [0.22, 0.8, 0.3, 1] });
      showSeed(targetIndex);
      seedX.set(-exitX * 0.42);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await animate(seedX, 0, { type: "spring", stiffness: 380, damping: 34, mass: 0.78 });
    } finally {
      seedTransitioningRef.current = false;
      setSeedTransitioning(false);
    }
  }

  async function chooseMbti(mbti: MbtiCode) {
    setBusy(true); setError("");
    try {
      const result = await authenticated<SeedBatch>("/onboarding/seed", { method: "POST", ...jsonBody({ mbti }) });
      setSeeds(result); setSeedIndex(0); setScreen("seeds");
    } catch { setError("这三杯还没靠岸，再试一次。"); }
    finally { setBusy(false); }
  }

  function showMbtiPicker() {
    if (busy || !bootstrapReady) return;
    setOnboardingChoiceError("");
    setOnboardingChoiceOpen(false);
    window.requestAnimationFrame(() => mbtiScreenRef.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus());
  }

  async function skipMbtiToFeed() {
    if (busy || !bootstrapReady) return;
    setBusy(true); setError(""); setOnboardingChoiceError("");
    try {
      if (!onboardingAlreadyCompletedRef.current) {
        await authenticated<SeedBatch>("/onboarding/seed", { method: "POST", ...jsonBody({ mbti: null }) });
        onboardingAlreadyCompletedRef.current = true;
      }
      await loadFeed();
      setOnboardingChoiceOpen(false);
    } catch {
      const message = "茶叶卡还没准备好，再试一次。";
      if (onboardingChoiceOpen) setOnboardingChoiceError(message);
      else setError(message);
    } finally { setBusy(false); }
  }

  async function swipe(action: "like" | "skip" | "save", direction?: -1 | 1) {
    const card = cards[cardIndex];
    if (!card || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const request = authenticated<SwipeResult>("/swipes", {
        method: "POST",
        ...jsonBody({ clientEventId: crypto.randomUUID(), cardId: card.cardId, action }),
      });
      const animation = direction && !reducedMotion
        ? animate(cardX, direction * Math.max(520, window.innerWidth * 1.35), { duration: 0.28, ease: [0.22, 0.8, 0.3, 1] })
        : Promise.resolve();
      const [result] = await Promise.all([request, animation]);
      if (result.accepted) incrementSwipe();
      const nextCard = cards[(cardIndex + 1) % cards.length];
      if (nextCard) useAppStore.getState().setFeedResumeCardId(nextCard.cardId);
      setRecommendation(result.recommendation ?? null);
      cardX.set(0);
      if (action === "save") {
        setNotice(`${card.name}已加入收藏`);
        if (result.recommendation) setScreen("recommendation");
        else setCardIndex((index) => (index + 1) % cards.length);
      }
      else if (result.reveal) { setReveal(result.reveal); setScreen("reveal"); }
      else if (result.recommendation) setScreen("recommendation");
      else setCardIndex((index) => (index + 1) % cards.length);
    } catch {
      await animate(cardX, 0, reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34 });
      setError("这张卡没滑过去，再试一次。");
    }
    finally { setBusy(false); }
  }

  function settleCard() {
    void animate(cardX, 0, reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34 });
  }

  function continueAfterReveal() {
    cardX.stop();
    cardX.set(0);
    dragStartPointX.current = null;
    setReveal(null);
    if (recommendation) setScreen("recommendation");
    else { setCardIndex((index) => (index + 1) % cards.length); setScreen("feed"); }
  }

  const deck = useMemo(() => {
    if (!cards.length) return [];
    return [0, 1, 2].map((depth) => ({ card: cards[(cardIndex + depth) % cards.length], depth }));
  }, [cardIndex, cards]);
  const selectedMbtiCode = mbtiAxes.join("") as MbtiCode;
  const selectedMbti = MBTI_OPTIONS.find((option) => option.code === selectedMbtiCode) ?? MBTI_OPTIONS[0];

  if (screen === "loading") return <p className="sr-only" role="status">正在载入</p>;

  if (screen === "mbti") return (
    <AppShell active="swipe" navigation={false} header={false} shellClassName="cold-start-shell"><section ref={mbtiScreenRef} className="onboarding-screen cold-start-screen" aria-hidden={onboardingChoiceOpen || undefined} inert={onboardingChoiceOpen || undefined}>
      <div className="cold-start-head"><span className="brand">Tea-BTI</span><span>1 / 2</span></div>
      <p className="eyebrow">先从四个字母开场</p>
      <h1 className="title">{HOME_COPY.mbtiTitle}</h1>
      <p className="subtitle">{forceOnboarding ? HOME_COPY.mbtiSharedIntro : HOME_COPY.mbtiIntro}</p>
      <div className="mbti-axes-picker" aria-label="分别选择四个 MBTI 维度">
        {MBTI_AXES.map((axis, index) => <MbtiAxisWheel
          key={axis.label}
          label={axis.label}
          choices={axis.choices}
          value={mbtiAxes[index]}
          disabled={busy || !bootstrapReady}
          onChange={(value) => setMbtiAxis(index, value)}
        />)}
      </div>
      <p className="mbti-selected-copy" aria-live="polite"><strong>{selectedMbti.code}</strong><span>{selectedMbti.line}</span></p>
      <button disabled={busy || !bootstrapReady} className="button primary block mbti-confirm" onClick={() => chooseMbti(selectedMbti.code as MbtiCode)}>{HOME_COPY.mbtiConfirm} · {selectedMbti.code} <ArrowRight size={18} /></button>
      <button disabled={busy || !bootstrapReady} className="mbti-skip" onClick={() => void skipMbtiToFeed()}>{HOME_COPY.mbtiSkip}</button>
      {error ? <div className="error onboarding-error" role="alert"><span>{error}</span>{error === HOME_COPY.retryTitle ? <button className="button compact" onClick={() => setBootstrapAttempt((attempt) => attempt + 1)}>{HOME_COPY.retryAction}</button> : null}</div> : null}
    </section>{onboardingChoiceOpen ? <OnboardingChoiceDialog busy={busy || !bootstrapReady} error={onboardingChoiceError} onChooseMbti={showMbtiPicker} onChooseCards={() => void skipMbtiToFeed()} /> : null}</AppShell>
  );

  if (screen === "seeds" && seeds) {
    const item = seeds.items[seedIndex];
    return (
      <AppShell active="swipe" navigation={false} header={false} shellClassName="cold-start-shell"><section className="seed-screen cold-start-screen">
        <div className="cold-start-head cold-start-head-with-back">
          <BackControl ariaLabel="返回 MBTI 选择" disabled={busy || seedTransitioning} onClick={() => { setSeeds(null); setSeedIndex(0); setScreen("mbti"); }} />
          <span className="brand">Tea-BTI</span><span>2 / 2</span>
        </div>
        <p className="eyebrow">{seeds.mbti ? `${seeds.mbti} · 开场三杯` : "凭感觉开场"}</p>
        <h1 className="section-title">{HOME_COPY.seedTitle}</h1>
        <p className="subtitle">{HOME_COPY.seedIntro}</p>
        <div className="seed-carousel" aria-label="三杯破冰结果" aria-roledescription="轮播">
          <motion.div
            className="seed-card-motion"
            key={item.role}
            role="button"
            tabIndex={0}
            aria-label={`查看${item.name}完整茶叶卡`}
            drag={seedTransitioning ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.82}
            dragMomentum={false}
            style={{ x: seedX, rotate: reducedMotion ? 0 : seedRotation, scale: seedScale }}
            onTap={() => setCardPreview({
              name: item.name,
              imageUrl: mediaUrl(item.visual.url),
              eyebrow: item.roleLabel,
              description: item.explanation,
              tags: item.tags,
            })}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setCardPreview({
                name: item.name,
                imageUrl: mediaUrl(item.visual.url),
                eyebrow: item.roleLabel,
                description: item.explanation,
                tags: item.tags,
              });
            }}
            onDragEnd={(_, info) => {
              const projected = info.offset.x + info.velocity.x * 0.12;
              if (projected < -SEED_SWIPE_THRESHOLD) void transitionSeed(seedIndex + 1, 1);
              else if (projected > SEED_SWIPE_THRESHOLD) void transitionSeed(seedIndex - 1, -1);
              else void animate(seedX, 0, reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34 });
            }}
          >
            <article className="seed-focus-card">
              <img className="presentation-art" draggable={false} src={mediaUrl(item.visual.url)} style={{ objectPosition: item.visual.objectPosition }} alt={`${item.name}立体设计图`} />
              <div className="seed-focus-copy"><span className="eyebrow">{item.roleLabel}</span><h2>{item.name}</h2><p>{item.explanation}</p>
                <span className="seed-preview-hint"><Eye size={16} />轻触查看完整卡面</span>
              </div>
            </article>
          </motion.div>
          <div className="seed-carousel-controls">
            <button aria-label="上一杯" disabled={seedIndex === 0 || seedTransitioning} onClick={() => void transitionSeed(seedIndex - 1, -1)}><CaretLeft size={18} /></button>
            <div className="seed-dots" aria-label={`第 ${seedIndex + 1} 杯，共 ${seeds.items.length} 杯`}>{seeds.items.map((seed, index) => <button key={seed.role} aria-label={`查看第 ${index + 1} 杯`} className={index === seedIndex ? "active" : ""} disabled={seedTransitioning} onClick={() => index !== seedIndex && void transitionSeed(index, index > seedIndex ? 1 : -1)} />)}</div>
            <button aria-label="下一杯" disabled={seedIndex === seeds.items.length - 1 || seedTransitioning} onClick={() => void transitionSeed(seedIndex + 1, 1)}><CaretRight size={18} /></button>
          </div>
          <p className="seed-swipe-hint">左右滑动，也可以换一杯</p>
        </div>
        <button className="button primary block seed-primary" onClick={() => void loadFeed()}>{HOME_COPY.seedPrimary} <ArrowRight size={18} /></button>
        {cardPreview ? <TeaCardPreview card={cardPreview} onClose={() => setCardPreview(null)} /> : null}
      </section></AppShell>
    );
  }

  if (screen === "reveal" && reveal) return (
    <AppShell active="swipe"><section className="sheet-screen" role="dialog" aria-modal="true" aria-label="喜欢的茶已揭晓">
      <button type="button" className="sheet-backdrop" aria-label="轻触遮罩关闭" onClick={continueAfterReveal} />
      <motion.article initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="bottom-sheet reveal-sheet">
        <span className="sheet-grabber" />
        <button type="button" className="sheet-visible-close" aria-label="关闭茶叶揭晓" onClick={continueAfterReveal}><X size={20} /></button>
        <img className="reveal-image presentation-art" src={mediaUrl(reveal.visual.url)} style={{ objectPosition: reveal.visual.objectPosition }} alt={`${reveal.name}立体设计图`} />
        <div><p className="eyebrow">{HOME_COPY.revealEyebrow}</p><h1 className="title">{reveal.name}</h1><p className="muted">{reveal.region} · {reveal.teaType}</p></div>
        <div className="tags light-tags">{reveal.professionalTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <p className="translation-card"><span>译</span>{reveal.translation}</p>
        <div className="button-row reveal-actions"><button className="button" onClick={continueAfterReveal}>继续刷</button><Link className="button primary" href={teaDetailHref(reveal.teaId, "swipe")}>看看这杯 <ArrowRight size={17} /></Link></div>
      </motion.article>
    </section></AppShell>
  );

  if (screen === "recommendation" && recommendation) return (
    <AppShell active="swipe"><section className="recommendation-screen">
      <BackControl ariaLabel="返回刷茶" className="flow-page-back" onClick={() => { setRecommendation(null); setCardIndex((index) => (index + 1) % cards.length); setScreen("feed"); }} />
      <p className="eyebrow">走过 {swipeCount} 杯之后</p>
      <h1 className="title">{HOME_COPY.recommendationTitle}</h1>
      <article className="recommendation-card">
        <img className="presentation-art" src={mediaUrl(recommendation.tea.visual.url)} style={{ objectPosition: recommendation.tea.visual.objectPosition }} alt={`${recommendation.tea.name}立体设计图`} />
        <div><small>此刻最合拍</small><h2>{recommendation.tea.name}</h2><p>{recommendation.tea.region}</p></div>
      </article>
      <div className="recommendation-reasons">{recommendation.reasons.map((reason) => <p key={reason}><Leaf size={15} weight="fill" />{reason}</p>)}</div>
      <Link className="button primary block" href={teaDetailHref(recommendation.tea.teaId, "swipe")}>喝这杯 <ArrowRight size={18} /></Link>
      <button className="button block" onClick={() => { setRecommendation(null); setCardIndex((index) => (index + 1) % cards.length); setScreen("feed"); }}>继续刷</button>
    </section></AppShell>
  );

  const card = cards[cardIndex];
  return card ? (
    <AppShell active="swipe" header={false} shellClassName="swipe-shell"><section className="feed-screen">
      <h1 className="sr-only">刷茶</h1>
      <span className="feed-progress">{HOME_COPY.feedProgress(swipeCount + 1)}</span>
      <div className="swipe-deck">
        {[...deck].reverse().map(({ card: deckCard, depth }) => depth === 0 ? (
          <motion.div
            key={`${deckCard.cardId}-${depth}`}
            className="deck-motion"
            role="button"
            tabIndex={0}
            aria-label={`查看${deckCard.name}完整茶叶卡`}
            drag={busy ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.86}
            dragMomentum={false}
            style={{ x: cardX, rotate: reducedMotion ? 0 : cardRotation }}
            onPointerDown={(event) => {
              previewPointerStart.current = { x: event.clientX, y: event.clientY };
              previewDragged.current = false;
            }}
            onPointerMove={(event) => {
              const start = previewPointerStart.current;
              if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) previewDragged.current = true;
            }}
            onTap={() => {
              if (previewDragged.current) return;
              setCardPreview({
                name: deckCard.name,
                imageUrl: mediaUrl(deckCard.visual.url),
                eyebrow: `${deckCard.region} · ${deckCard.teaType}`,
                description: deckCard.headline,
                tags: deckCard.personalityKeywords,
              });
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setCardPreview({
                name: deckCard.name,
                imageUrl: mediaUrl(deckCard.visual.url),
                eyebrow: `${deckCard.region} · ${deckCard.teaType}`,
                description: deckCard.headline,
                tags: deckCard.personalityKeywords,
              });
            }}
            onDragStart={(_, info) => { dragStartPointX.current = info.point.x; }}
            onDragEnd={(_, info) => {
              const pointerOffset = dragStartPointX.current === null ? 0 : info.point.x - dragStartPointX.current;
              const dragOffset = [info.offset.x, pointerOffset, cardX.get()].reduce((strongest, current) => (
                Math.abs(current) > Math.abs(strongest) ? current : strongest
              ), 0);
              dragStartPointX.current = null;
              if (dragOffset > SWIPE_THRESHOLD) void swipe("like", 1);
              else if (dragOffset < -SWIPE_THRESHOLD) void swipe("skip", -1);
              else settleCard();
            }}
          >
            <motion.div className="swipe-verdict skip-verdict" style={{ opacity: skipProgress, scale: skipScale }}><X size={29} weight="bold" /><span>不对胃</span></motion.div>
            <motion.div className="swipe-verdict like-verdict" style={{ opacity: likeProgress, scale: likeScale }}><Heart size={28} weight="fill" /><span>想喝</span></motion.div>
            <TeaSwipeCard card={deckCard} depth={depth} />
          </motion.div>
        ) : <motion.div
          className={`deck-layer depth-${depth}`}
          style={depth === 1 ? { y: secondY, scale: secondScale, opacity: secondOpacity } : { y: thirdY, scale: thirdScale, opacity: thirdOpacity }}
          key={`${deckCard.cardId}-${depth}`}
        ><TeaSwipeCard card={deckCard} depth={depth} /></motion.div>)}
      </div>
      <div className="swipe-actions">
        <motion.button disabled={busy} className="swipe-action skip" aria-label="这杯不对胃" style={{ scale: skipScale, opacity: skipOpacity, boxShadow: skipGlow }} onClick={() => void swipe("skip", -1)}><X size={26} weight="bold" /><span>不对胃</span></motion.button>
        <button disabled={busy} className="swipe-action save" aria-label="先收藏" onClick={() => void swipe("save")}><BookmarkSimple size={23} weight="bold" /><span>收藏</span></button>
        <motion.button disabled={busy} className="swipe-action like" aria-label="这杯想喝" style={{ scale: likeScale, opacity: likeOpacity, boxShadow: likeGlow }} onClick={() => void swipe("like", 1)}><Heart size={27} weight="fill" /><span>想喝</span></motion.button>
      </div>
      {error ? <p className="error swipe-error" role="alert">{error}</p> : null}
      {notice ? <p className="swipe-notice" role="status">{notice}</p> : null}
      {cardPreview ? <TeaCardPreview card={cardPreview} onClose={() => setCardPreview(null)} /> : null}
    </section></AppShell>
  ) : <AppShell active="swipe"><div className="empty"><button className="button" onClick={() => void loadFeed()}>重新装一组卡片</button></div></AppShell>;
}
