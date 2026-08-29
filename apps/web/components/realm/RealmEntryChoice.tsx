"use client";

import { BookOpenText, GameController, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

export function RealmEntryChoice({ open, continuing, busy, onClose, onInteractive, onStory }: {
  open: boolean;
  continuing: boolean;
  busy: boolean;
  onClose: () => void;
  onInteractive: () => void;
  onStory: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (busy) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
    };
  }, [busy, onClose, open]);

  if (!open) return null;
  return (
    <div className="realm-choice-backdrop" onPointerDown={() => { if (!busy) onClose(); }}>
      <div ref={dialogRef} className="realm-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="realm-choice-title" onPointerDown={(event) => event.stopPropagation()}>
        <button className="realm-choice-close" aria-label="关闭进入方式选择" disabled={busy} onClick={onClose}><X size={18} /></button>
        <p className="eyebrow">雾里一芽 · 两种走法</p>
        <h2 id="realm-choice-title">你想怎样认识这杯茶？</h2>
        <p>亲手走完一芽的变化，或者安静读完它从黔南山地到杯中的来路。</p>
        <button ref={primaryRef} className="realm-choice-option primary" disabled={busy} onClick={onInteractive}>
          <GameController size={25} weight="duotone" />
          <span><strong>{continuing ? "继续互动，走完这一芽" : "通过互动，亲手走完这一芽"}</strong><small>约 70–100 秒 · 可使用倾斜或触控</small></span>
        </button>
        <button className="realm-choice-option" disabled={busy} onClick={onStory}>
          <BookOpenText size={25} weight="duotone" />
          <span><strong>直接阅读，了解这杯茶的来路</strong><small>约 4 分钟 · 不请求方向或麦克风权限</small></span>
        </button>
      </div>
    </div>
  );
}
