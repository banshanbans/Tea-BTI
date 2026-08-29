"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const LEAF_COUNT = 14;
const GRAVITY = 0.18;

type WokLeaf = {
  el: HTMLSpanElement | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  radius: number;
};

type DragState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
};

function stepPhysics(wok: HTMLDivElement, leaves: WokLeaf[], drag: DragState) {
  const rect = wok.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!width || !height) return;
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = Math.max(10, width / 2 - 10);
  const radiusY = Math.max(10, height / 2 - 10);

  for (const leaf of leaves) {
    if (drag.active) {
      const dx = leaf.x - drag.x;
      const dy = leaf.y - drag.y;
      const distance = Math.hypot(dx, dy) || 1;
      const influence = Math.max(0, 1 - distance / 95);
      leaf.vx += drag.vx * influence * 0.35;
      leaf.vy += drag.vy * influence * 0.35;
      leaf.angularVelocity += ((dx * drag.vy) - (dy * drag.vx)) / (distance * distance) * 0.06;
    }
    leaf.vx *= 0.955;
    leaf.vy = leaf.vy * 0.955 + GRAVITY;
    leaf.angularVelocity *= 0.97;
    leaf.x += leaf.vx;
    leaf.y += leaf.vy;
    leaf.angle += leaf.angularVelocity;

    const normalizedX = (leaf.x - centerX) / radiusX;
    const normalizedY = (leaf.y - centerY) / radiusY;
    const normalizedDistance = Math.hypot(normalizedX, normalizedY);
    if (normalizedDistance > 1) {
      const edgeX = normalizedX / normalizedDistance;
      const edgeY = normalizedY / normalizedDistance;
      leaf.x = centerX + edgeX * radiusX;
      leaf.y = centerY + edgeY * radiusY;
      const velocityAtEdge = leaf.vx * edgeX + leaf.vy * edgeY;
      if (velocityAtEdge > 0) {
        leaf.vx -= 2 * velocityAtEdge * edgeX;
        leaf.vy -= 2 * velocityAtEdge * edgeY;
      }
      leaf.vx *= 0.72;
      leaf.vy *= 0.72;
    }
  }

  for (let left = 0; left < leaves.length; left += 1) {
    for (let right = left + 1; right < leaves.length; right += 1) {
      const first = leaves[left];
      const second = leaves[right];
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const distance = Math.hypot(dx, dy);
      const minimum = first.radius + second.radius;
      if (distance <= 0.001 || distance >= minimum) continue;
      const normalX = dx / distance;
      const normalY = dy / distance;
      const overlap = (minimum - distance) / 2;
      first.x -= normalX * overlap;
      first.y -= normalY * overlap;
      second.x += normalX * overlap;
      second.y += normalY * overlap;
    }
  }

  for (const leaf of leaves) {
    if (leaf.el) leaf.el.style.transform = `translate(${leaf.x}px, ${leaf.y}px) translate(-50%, -50%) rotate(${leaf.angle}deg)`;
  }
}

export function useWokPhysics({ active, onDistance }: { active: boolean; onDistance: (distance: number) => void }) {
  const wokRef = useRef<HTMLDivElement>(null);
  const leafElementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const leavesRef = useRef<WokLeaf[]>([]);
  const dragRef = useRef<DragState>({ x: 0, y: 0, vx: 0, vy: 0, active: false });
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const distanceCallbackRef = useRef(onDistance);
  distanceCallbackRef.current = onDistance;

  useEffect(() => {
    if (!active) return;
    let setupFrame = 0;
    let animationFrame = 0;

    const stop = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
    const startLoop = () => {
      if (animationFrame || document.hidden) return;
      const tick = () => {
        const wok = wokRef.current;
        if (!wok || document.hidden) {
          animationFrame = 0;
          return;
        }
        stepPhysics(wok, leavesRef.current, dragRef.current);
        animationFrame = window.requestAnimationFrame(tick);
      };
      animationFrame = window.requestAnimationFrame(tick);
    };
    const setup = () => {
      const wok = wokRef.current;
      if (!wok) {
        setupFrame = window.requestAnimationFrame(setup);
        return;
      }
      const rect = wok.getBoundingClientRect();
      leavesRef.current = Array.from({ length: LEAF_COUNT }, (_, index) => {
        const angle = (index / LEAF_COUNT) * Math.PI * 2 + ((index * 37) % 11) / 20;
        const distance = Math.min(rect.width, rect.height) * (0.16 + ((index * 19) % 9) / 90);
        return {
          el: leafElementsRef.current[index] ?? null,
          x: rect.width / 2 + Math.cos(angle) * distance,
          y: rect.height / 2 + Math.sin(angle) * distance,
          vx: 0,
          vy: 0,
          angle: (index * 47) % 360,
          angularVelocity: ((index % 5) - 2) * 0.7,
          radius: 15 + (index % 4) * 2,
        };
      });
      dragRef.current = { x: rect.width / 2, y: rect.height / 2, vx: 0, vy: 0, active: false };
      startLoop();
    };
    const handleVisibility = () => document.hidden ? stop() : startLoop();

    setupFrame = window.requestAnimationFrame(setup);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.cancelAnimationFrame(setupFrame);
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      leavesRef.current = [];
      dragRef.current.active = false;
    };
  }, [active]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const wok = wokRef.current;
    if (!wok) return;
    const rect = wok.getBoundingClientRect();
    pointerRef.current = { x: event.clientX, y: event.clientY };
    dragRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      vx: 0,
      vy: 0,
      active: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointerRef.current;
    const wok = wokRef.current;
    if (!previous || !wok) return;
    const rect = wok.getBoundingClientRect();
    const distance = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
    pointerRef.current = { x: event.clientX, y: event.clientY };
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    dragRef.current.vx = x - dragRef.current.x;
    dragRef.current.vy = y - dragRef.current.y;
    dragRef.current.x = x;
    dragRef.current.y = y;
    distanceCallbackRef.current(distance);
  }, []);

  const onPointerUp = useCallback(() => {
    pointerRef.current = null;
    dragRef.current.active = false;
    dragRef.current.vx = 0;
    dragRef.current.vy = 0;
  }, []);

  return { wokRef, leafElementsRef, onPointerDown, onPointerMove, onPointerUp };
}
