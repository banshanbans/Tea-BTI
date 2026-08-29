import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BudPickerVisual, HumanJudgmentVisual, LiquorEntryVisual, WokCraftVisual } from "./RealmSceneVisuals";

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

    rerender(<BudPickerVisual assetUrls={assetUrls} chosen={false} feedback="" busy={false} onChoose={vi.fn()} onAdvance={vi.fn().mockResolvedValue(true)} />);
    expect([...container.querySelectorAll("img")].map((image) => image.getAttribute("src"))).toEqual([
      "/media/bud-single.webp",
      "/media/bud-leaf.webp",
      "/media/bud-open.webp",
      "/media/bud-stem.webp",
    ]);
    expect(container.querySelector('img[src^="/realm/"]')).not.toBeInTheDocument();
  });

  it("keeps human judgment manual without an automatic countdown", () => {
    vi.useFakeTimers();
    const onTry = vi.fn();
    const onStop = vi.fn();
    render(<HumanJudgmentVisual maturity={0} onTry={onTry} onStop={onStop} />);

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("再摸一次叶片的状态，停手的时刻由你来定。")).toBeInTheDocument();
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
    const { unmount } = render(<WokCraftVisual craftIndex={0} animated busy={false} onDistance={vi.fn()} onKeyboardStep={vi.fn()} onAdvance={vi.fn().mockResolvedValue(true)} />);

    act(() => callbacks.get(1)?.(0));
    expect(request).toHaveBeenCalledTimes(2);
    unmount();
    expect(cancel).toHaveBeenCalledWith(1);
    expect(cancel).toHaveBeenCalledWith(2);
  });
});
