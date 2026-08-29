"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  recognizeCircle,
  recognizeForwardPush,
  recognizePekoeMulti,
  recognizePekoeSingle,
  recognizeRolling,
  recognizeTiltAlternations,
} from "@/components/realm/craftGestureRecognizer";
import type { GesturePoint } from "@/components/realm/craftGestureRecognizer";

export const craftGestureIds = ["killGreen", "rolling", "balling", "pekoe"] as const;
export type CraftGestureId = typeof craftGestureIds[number];
export type CraftInputMode = "orientation" | "pointer" | "multitouch" | "keyboard" | "assisted" | "reducedMotion";
export type CraftGestureResult = { inputMode: CraftInputMode; score: number; attempts: number };

export function useCraftController({ orientationActive, gamma, reducedMotion, onCompleteTone, onMultitouchFallback }: {
  orientationActive: boolean;
  gamma: number;
  reducedMotion: boolean;
  onCompleteTone: (index: number) => void;
  onMultitouchFallback: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<CraftGestureId, number>>({ killGreen: 0, rolling: 0, balling: 0, pekoe: 0 });
  const [results, setResults] = useState<Partial<Record<CraftGestureId, CraftGestureResult>>>({});
  const [forwardPushes, setForwardPushes] = useState(0);
  const tracksRef = useRef(new Map<number, GesturePoint[]>());
  const finishedTracksRef = useRef<GesturePoint[][]>([]);
  const tiltSamplesRef = useRef<number[]>([]);
  const completionLockRef = useRef(false);
  const current = craftGestureIds[index];

  const complete = useCallback((inputMode: CraftInputMode, score: number, resultAttempts?: number) => {
    const gesture = craftGestureIds[index];
    if (!gesture || completionLockRef.current) return;
    completionLockRef.current = true;
    const finalAttempts = resultAttempts ?? Math.max(1, attempts[gesture] + 1);
    setResults((value) => ({ ...value, [gesture]: { inputMode, score, attempts: finalAttempts } }));
    onCompleteTone(index);
    setIndex((value) => Math.min(craftGestureIds.length, value + 1));
    setForwardPushes(0);
    tracksRef.current.clear();
    finishedTracksRef.current = [];
    window.setTimeout(() => { completionLockRef.current = false; }, 80);
  }, [attempts, index, onCompleteTone]);

  const fail = useCallback(() => {
    const gesture = craftGestureIds[index];
    if (!gesture) return;
    setAttempts((value) => ({ ...value, [gesture]: value[gesture] + 1 }));
  }, [index]);

  useEffect(() => {
    if (!orientationActive || current !== "killGreen") return;
    if (Math.abs(gamma) < 6) return;
    const samples = tiltSamplesRef.current;
    if (!samples.length || Math.sign(samples.at(-1)!) !== Math.sign(gamma)) samples.push(gamma);
    const result = recognizeTiltAlternations(samples);
    if (result.matched) complete("orientation", result.score, 1);
  }, [complete, current, gamma, orientationActive]);

  useEffect(() => {
    if (current === "pekoe" && navigator.maxTouchPoints < 2) onMultitouchFallback();
  }, [current, onMultitouchFallback]);

  const pointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    tracksRef.current.set(event.pointerId, [{ x: event.clientX - rect.left, y: event.clientY - rect.top, time: performance.now() }]);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const pointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const track = tracksRef.current.get(event.pointerId);
    if (!track) return;
    const rect = event.currentTarget.getBoundingClientRect();
    track.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, time: performance.now() });
  }, []);

  const pointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const track = tracksRef.current.get(event.pointerId);
    if (!track || !current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    tracksRef.current.delete(event.pointerId);
    finishedTracksRef.current.push(track);
    if (current === "killGreen") {
      const result = recognizeForwardPush(track, rect.width, rect.height);
      if (!result.matched) { fail(); return; }
      const pushes = forwardPushes + 1;
      setForwardPushes(pushes);
      if (pushes >= 3) complete("pointer", result.score, Math.max(1, attempts.killGreen + 1));
      return;
    }
    if (current === "rolling") {
      const result = recognizeRolling(track, rect.width, rect.height);
      result.matched ? complete("pointer", result.score) : fail();
      return;
    }
    if (current === "balling") {
      const result = recognizeCircle(track, rect.width, rect.height);
      result.matched ? complete("pointer", result.score) : fail();
      return;
    }
    if (current === "pekoe") {
      const finished = finishedTracksRef.current.slice(-2);
      const multi = finished.length === 2 ? recognizePekoeMulti(finished[0], finished[1], rect.width) : { matched: false, score: 0 };
      if (multi.matched) complete("multitouch", multi.score);
      else {
        const single = recognizePekoeSingle(track, rect.height);
        single.matched ? complete("pointer", single.score) : fail();
      }
    }
  }, [attempts.killGreen, complete, current, fail, forwardPushes]);

  const assist = useCallback(() => complete("assisted", 50, Math.max(3, current ? attempts[current] : 3)), [attempts, complete, current]);
  const keyboard = useCallback(() => complete(reducedMotion ? "reducedMotion" : "keyboard", 60, 1), [complete, reducedMotion]);
  const canAssist = Boolean(current && attempts[current] >= 3);
  const reset = useCallback(() => {
    setIndex(0); setAttempts({ killGreen: 0, rolling: 0, balling: 0, pekoe: 0 });
    setResults({}); setForwardPushes(0); tracksRef.current.clear(); finishedTracksRef.current = []; tiltSamplesRef.current = [];
  }, []);

  return useMemo(() => ({ index, current, attempts, results, canAssist, pointerDown, pointerMove, pointerUp, assist, keyboard, reset }),
    [attempts, assist, canAssist, current, index, keyboard, pointerDown, pointerMove, pointerUp, reset, results]);
}
