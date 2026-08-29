"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SteamMode = "microphone" | "wipe" | "keyboard" | "reducedMotion";
export type SteamState = "idle" | "listening" | "fallback" | "cleared";

export function useSteamBlow({ active, reducedMotion, onFallback }: {
  active: boolean;
  reducedMotion: boolean;
  onFallback: (reason: "microphone_denied" | "microphone_unsupported" | "microphone_error" | "microphone_timeout") => void;
}) {
  const [state, setState] = useState<SteamState>(reducedMotion ? "fallback" : "idle");
  const [mode, setMode] = useState<SteamMode | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const stateRef = useRef<SteamState>(state);
  stateRef.current = state;
  const resourcesRef = useRef<{ stream?: MediaStream; context?: AudioContext; frame?: number; timeout?: number }>({});
  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;

  const cleanup = useCallback(() => {
    const resources = resourcesRef.current;
    if (resources.frame) window.cancelAnimationFrame(resources.frame);
    if (resources.timeout) window.clearTimeout(resources.timeout);
    resources.stream?.getTracks().forEach((track) => track.stop());
    if (resources.context && resources.context.state !== "closed") void resources.context.close();
    resourcesRef.current = {};
  }, []);

  const fallback = useCallback((reason: Parameters<typeof onFallback>[0]) => {
    cleanup();
    setCalibrating(false);
    setState("fallback");
    fallbackRef.current(reason);
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!active || state === "listening" || state === "cleared") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      fallback("microphone_unsupported");
      return;
    }
    setState("listening");
    setCalibrating(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        fallback("microphone_unsupported");
        return;
      }
      const context = new AudioContextClass();
      if (context.state === "suspended") await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      const baselineUntil = performance.now() + 600;
      const baselineValues: number[] = [];
      let baseline = 0;
      let calibrated = false;
      let aboveSince = 0;
      resourcesRef.current = { stream, context };
      const sample = () => {
        analyser.getByteTimeDomainData(values);
        const rms = Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length);
        const now = performance.now();
        if (now < baselineUntil) {
          baselineValues.push(rms);
        } else {
          if (!calibrated) {
            const sorted = [...baselineValues].sort((left, right) => left - right);
            baseline = sorted[Math.floor(sorted.length * 0.25)] || 0;
            calibrated = true;
            setCalibrating(false);
          }
          const threshold = Math.max(0.025, baseline + 0.018, baseline * 1.55);
          aboveSince = rms >= threshold ? (aboveSince || now) : 0;
          if (aboveSince && now - aboveSince >= 180) {
            cleanup(); setMode("microphone"); setState("cleared"); return;
          }
        }
        resourcesRef.current.frame = window.requestAnimationFrame(sample);
      };
      resourcesRef.current.frame = window.requestAnimationFrame(sample);
      resourcesRef.current.timeout = window.setTimeout(() => fallback("microphone_timeout"), 8000);
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      fallback(denied ? "microphone_denied" : "microphone_error");
    }
  }, [active, cleanup, fallback, state]);

  const clearWith = useCallback((nextMode: SteamMode) => {
    cleanup(); setCalibrating(false); setMode(nextMode); setState("cleared");
  }, [cleanup]);
  const chooseWipe = useCallback(() => {
    cleanup(); setCalibrating(false); setState("fallback");
  }, [cleanup]);

  useEffect(() => {
    if (!active) cleanup();
  }, [active, cleanup]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && stateRef.current === "listening") fallback("microphone_error");
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); cleanup(); };
  }, [cleanup, fallback]);

  return { state, mode, calibrating, start, chooseWipe, wipe: () => clearWith("wipe"), keyboard: () => clearWith(reducedMotion ? "reducedMotion" : "keyboard"), cleanup };
}
