import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BudPickerVisual, HumanJudgmentVisual, isBudLift, LiquorEntryVisual, WokCraftVisual } from "./RealmSceneVisuals";

describe("Realm scene visual controllers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders all six generated runtime assets from injected API URLs", () => {
    const assetUrls = new Map([
      ["bud_single", "/media/bud-single.webp"],
      ["bud_leaf", "/media/bud-leaf.webp"],
      ["bud_open", "/media/bud-open.webp"],
      ["bud_stem", "/media/bud-stem.webp"],
    ]);
    const { container, rerender } = render(<LiquorEntryVisual liquorUrl="/media/liquor.webp" rippleUrl="/media/ripple.webp" busy={false} skipAnimations onAdvance={vi.fn().mockResolvedValue(true)} />);
    expect([...container.querySelectorAll("img")].map((image) => image.getAttribute("src"))).toEqual(["/media/liquor.webp", "/media/ripple.webp"]);

    rerender(<BudPickerVisual assetUrls={assetUrls} chosen={false} feedback="" teacherMessage="" busy={false} reducedMotion={false} onChoose={vi.fn()} onAdvance={vi.fn().mockResolvedValue(true)} />);
    expect([...container.querySelectorAll("img")].map((image) => image.getAttribute("src"))).toEqual([
      "/media/bud-single.webp",
      "/media/bud-leaf.webp",
      "/media/bud-open.webp",
      "/media/bud-stem.webp",
    ]);
    expect(container.querySelector('img[src^="/realm/"]')).not.toBeInTheDocument();
  });

  it("requires a deliberate hold and 64px lift, then gives the first wrong pick a teacher intervention", () => {
    const onChoose = vi.fn();
    const { container } = render(<BudPickerVisual assetUrls={new Map()} teacherUrl="/media/teacher-correction.webp" chosen={false} feedback="" teacherMessage="这个还嫩了点。" teacherTarget="bud-single" busy={false} reducedMotion={false} onChoose={onChoose} onAdvance={vi.fn().mockResolvedValue(true)} />);
    expect(isBudLift(160, 95, 180)).toBe(true);
    expect(isBudLift(160, 97, 180)).toBe(false);
    expect(isBudLift(160, 90, 179)).toBe(false);
    fireEvent.keyDown(screen.getByRole("button", { name: "一芽一叶" }), { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith("bud-leaf", "keyboard");
    expect(screen.getByText("茶师傅")).toBeInTheDocument();
    expect(screen.getByText("这个还嫩了点。")).toBeInTheDocument();
    expect(container.querySelector(".realm-teacher-bud-single")).toBeInTheDocument();
  });

  it("keeps the bud under the finger and completes an upward pointer lift", () => {
    const onChoose = vi.fn();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(100);
    render(<BudPickerVisual assetUrls={new Map()} chosen={false} feedback="" teacherMessage="" busy={false} reducedMotion={false} onChoose={onChoose} onAdvance={vi.fn().mockResolvedValue(true)} />);
    const bud = screen.getByRole("button", { name: "一芽一叶" });

    fireEvent(bud, new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientY: 240 }));
    fireEvent(bud, new MouseEvent("pointermove", { bubbles: true, cancelable: true, clientY: 164 }));
    expect(bud).toHaveClass("dragging");
    expect(bud).toHaveStyle({ transform: "translateY(-76px)" });
    now.mockReturnValue(310);
    fireEvent(bud, new MouseEvent("pointerup", { bubbles: true, cancelable: true, clientY: 164 }));

    expect(onChoose).toHaveBeenCalledWith("bud-leaf", "pointer");
    expect(bud).not.toHaveClass("dragging");
  });

  it("keeps human judgment manual without an automatic countdown", () => {
    vi.useFakeTimers();
    const onTry = vi.fn();
    const onStop = vi.fn();
    render(<HumanJudgmentVisual maturity={0} onTry={onTry} onStop={onStop} />);

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText(/没有唯一答案，停手的时刻由你来定/)).toBeInTheDocument();
    expect(screen.queryByText(/偏早|刚好|偏晚/)).not.toBeInTheDocument();
    expect(onTry).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "现在停" }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("cancels the wok physics loop when the scene unmounts", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let sequence = 0;
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      sequence += 1;
      callbacks.set(sequence, callback);
      return sequence;
    });
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { callbacks.delete(id); });
    const { unmount } = render(<WokCraftVisual animated busy={false} mode="pointer" gamma={0} tiltRef={{ current: { x: 0, y: 0 } }} onFallback={vi.fn()} onTone={vi.fn()} onAdvance={vi.fn().mockResolvedValue(true)} />);

    act(() => callbacks.get(1)?.(0));
    expect(request).toHaveBeenCalledTimes(2);
    unmount();
    expect(cancel).toHaveBeenCalledWith(1);
    expect(cancel).toHaveBeenCalledWith(2);
  });

  it("requests microphone only after the blow action and stops the granted track when audio analysis is unavailable", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const onFallback = vi.fn();
    render(<WokCraftVisual animated={false} busy={false} mode="pointer" gamma={0} tiltRef={{ current: { x: 0, y: 0 } }} onFallback={onFallback} onTone={vi.fn()} onAdvance={vi.fn().mockResolvedValue(true)} />);
    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "吹一下，让蒸汽散开" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }));
    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(onFallback).toHaveBeenCalledWith("microphone_unsupported");
    expect(screen.getByRole("button", { name: "左右擦开蒸汽" })).toBeInTheDocument();
    const wok = screen.getByRole("button", { name: "制茶手势区域" });
    fireEvent.pointerDown(wok, { pointerId: 1, clientX: 20 });
    fireEvent.pointerMove(wok, { pointerId: 1, clientX: 80 });
    expect(screen.getByText("向前推")).toBeInTheDocument();
  });

  it("releases microphone and AudioContext on page hide, then offers the wipe fallback", async () => {
    const stop = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    Object.defineProperty(window, "AudioContext", { configurable: true, value: class {
      state = "running";
      createAnalyser() { return { fftSize: 512, getByteTimeDomainData(values: Uint8Array) { values.fill(128); } }; }
      createMediaStreamSource() { return { connect: vi.fn() }; }
      close = close;
    } });
    const onFallback = vi.fn();
    render(<WokCraftVisual animated={false} busy={false} mode="pointer" gamma={0} tiltRef={{ current: { x: 0, y: 0 } }} onFallback={onFallback} onTone={vi.fn()} onAdvance={vi.fn().mockResolvedValue(true)} />);
    fireEvent.click(screen.getByRole("button", { name: "吹一下，让蒸汽散开" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
    expect(close).toHaveBeenCalledOnce();
    expect(onFallback).toHaveBeenCalledWith("microphone_error");
    expect(screen.getByRole("button", { name: "左右擦开蒸汽" })).toBeInTheDocument();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("lets users skip steam immediately and only offers gesture assistance after three misses", () => {
    render(<WokCraftVisual animated={false} busy={false} mode="pointer" gamma={0} tiltRef={{ current: { x: 0, y: 0 } }} onFallback={vi.fn()} onTone={vi.fn()} onAdvance={vi.fn().mockResolvedValue(true)} />);
    fireEvent.click(screen.getByRole("button", { name: "直接开始制茶" }));
    const wok = screen.getByRole("button", { name: "制茶手势区域" });

    fireEvent.pointerDown(wok, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(wok, { pointerId: 1, clientX: 20, clientY: 20 });
    expect(screen.queryByRole("button", { name: "这一步识别不顺，直接完成" })).not.toBeInTheDocument();
    fireEvent.pointerDown(wok, { pointerId: 2, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(wok, { pointerId: 2, clientX: 20, clientY: 20 });
    expect(screen.queryByRole("button", { name: "这一步识别不顺，直接完成" })).not.toBeInTheDocument();
    fireEvent.pointerDown(wok, { pointerId: 3, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(wok, { pointerId: 3, clientX: 20, clientY: 20 });
    expect(screen.getByRole("button", { name: "这一步识别不顺，直接完成" })).toBeInTheDocument();
  });
});
