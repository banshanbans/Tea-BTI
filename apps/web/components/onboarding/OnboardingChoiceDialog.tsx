"use client";

import { ArrowRight, Leaf, X } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

export function OnboardingChoiceDialog({ busy, error, onChooseMbti, onChooseCards }: {
  busy: boolean;
  error: string;
  onChooseMbti: () => void;
  onChooseCards: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const dismissRef = useRef(onChooseMbti);
  const reducedMotion = useReducedMotion();
  busyRef.current = busy;
  dismissRef.current = onChooseMbti;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => primaryRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!busyRef.current) dismissRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <section className="onboarding-choice-layer" role="dialog" aria-modal="true" aria-labelledby="onboarding-choice-title" aria-describedby="onboarding-choice-description">
      <button type="button" className="onboarding-choice-backdrop" tabIndex={-1} disabled={busy} aria-label="关闭并进入 MBTI 选择" onClick={onChooseMbti} />
      <motion.article
        ref={dialogRef}
        className="onboarding-choice-dialog"
        initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 29 }}
      >
        <button type="button" className="onboarding-choice-close" disabled={busy} aria-label="关闭并进入 MBTI 选择" onClick={onChooseMbti}><X size={19} /></button>
        <span className="onboarding-choice-mark" aria-hidden="true"><Leaf size={22} weight="fill" /></span>
        <p className="eyebrow">贵州本命茶</p>
        <h1 id="onboarding-choice-title">让我根据你的 MBTI，推荐属于你的贵州本命茶</h1>
        <p id="onboarding-choice-description">知道自己的 MBTI？从四个字母开始。还不知道也没关系，可以直接看看茶叶卡，凭感觉选出你喜欢的。</p>
        <div className="onboarding-choice-actions">
          <button ref={primaryRef} type="button" className="button primary block" disabled={busy} onClick={onChooseMbti}>我知道自己的 MBTI <ArrowRight size={18} /></button>
          <button type="button" className="button block" disabled={busy} onClick={onChooseCards}>{busy ? "正在打开茶叶卡…" : "还不知道，直接看茶叶卡"}</button>
        </div>
        {error ? <p className="error onboarding-choice-error" role="alert">{error}</p> : null}
      </motion.article>
    </section>
  );
}
