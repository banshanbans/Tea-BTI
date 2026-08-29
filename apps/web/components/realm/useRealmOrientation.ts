"use client";

import { useEffect, useRef, useState } from "react";

export type TiltVector = { x: number; y: number };

export function useRealmOrientation({ active, onSignalLost }: { active: boolean; onSignalLost: () => void }) {
  const tiltRef = useRef<TiltVector>({ x: 0, y: 0 });
  const [gamma, setGamma] = useState(0);
  const [signalReady, setSignalReady] = useState(false);
  const lostCallbackRef = useRef(onSignalLost);
  lostCallbackRef.current = onSignalLost;

  useEffect(() => {
    if (!active) {
      tiltRef.current = { x: 0, y: 0 };
      setSignalReady(false);
      return;
    }
    let samples = 0;
    let baselineGamma = 0;
    let baselineBeta = 0;
    let filteredGamma = 0;
    let filteredBeta = 0;
    let gotSignal = false;
    const timeout = window.setTimeout(() => {
      if (!gotSignal) lostCallbackRef.current();
    }, 1800);
    const handle = (event: DeviceOrientationEvent) => {
      if (typeof event.gamma !== "number" || typeof event.beta !== "number") return;
      gotSignal = true;
      if (samples < 5) {
        samples += 1;
        baselineGamma += event.gamma / 5;
        baselineBeta += event.beta / 5;
        if (samples === 5) setSignalReady(true);
        return;
      }
      filteredGamma += ((event.gamma - baselineGamma) - filteredGamma) * 0.2;
      filteredBeta += ((event.beta - baselineBeta) - filteredBeta) * 0.2;
      const x = Math.max(-18, Math.min(18, Math.abs(filteredGamma) < 3 ? 0 : filteredGamma));
      const y = Math.max(-18, Math.min(18, Math.abs(filteredBeta) < 3 ? 0 : filteredBeta));
      tiltRef.current = { x, y };
      setGamma(x);
    };
    window.addEventListener("deviceorientation", handle);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("deviceorientation", handle);
      tiltRef.current = { x: 0, y: 0 };
    };
  }, [active]);

  return { tiltRef, gamma, signalReady };
}
