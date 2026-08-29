import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authenticated } from "@/lib/api";
import { RealmExperience } from "./RealmExperience";

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
  mediaUrl: (path: string) => path,
}));

const sceneOrder = ["liquor-entry", "mist-mountain", "pick-bud", "wok-craft", "human-judgment", "real-tea-reveal", "passport-specimen"];
const scenes = sceneOrder.map((id, index) => ({ id, eyebrow: `Scene ${index}`, title: ["杯中起雾", "雾后是黔南的山", "哪一片，会成为毛尖？", "让鲜叶慢慢成为茶", "什么时候该停？", "这就是都匀毛尖", "留下一枚白毫标本"][index], instruction: "完成这一幕", completionCopy: "完成", interaction: "tap", assetIds: [] }));
const progress = (currentScene: string, completedScenes: string[] = []) => ({
  realmId: "duyun-maojian-mist-bud", teaId: "duyun-maojian", status: "in_progress" as const,
  currentScene, completedScenes, interactionMode: "pointer" as const, totalElapsedMs: 0, replayCount: 0, usedTasteWords: false,
});
const run = (currentScene: string, completedScenes: string[] = []) => ({
  runId: "run-v2", replay: false, currentScene, completedScenes, sceneResults: {}, interactionMode: "pointer" as const,
  totalElapsedMs: 0, startedAt: "2026-08-29T00:00:00Z", updatedAt: "2026-08-29T00:00:00Z", completedAt: null,
});
const detail = {
  definition: {
    realmId: "duyun-maojian-mist-bud", teaId: "duyun-maojian", title: "雾里一芽", subtitle: "七幕", regionId: "qiannan", regionLabel: "贵州 · 黔南",
    sceneOrder, scenes, specimen: { id: "duyun-maojian-pekoe" }, evidenceRefs: [],
    assets: ["mountain_background", "mist_overlay", "workshop_background", "dry_tea_reveal", "specimen_card", "liquor_base", "liquor_ripple", "bud_single", "bud_leaf", "bud_open", "bud_stem"].map((role) => ({ assetId: role, role, url: `/media/${role}.webp`, sourceKind: role === "dry_tea_reveal" ? "open_access_figure" : "ai_generated", authenticityState: role === "dry_tea_reveal" ? "documentary" : "synthetic_demo", rightsState: role === "dry_tea_reveal" ? "open_license" : "demo_only", rightsNote: "test", evidenceRefIds: [] })),
  },
  progress: { ...progress("liquor-entry"), status: "available" as const, interactionMode: null },
  run: null,
  outcome: null,
  personalization: { source: "default" as const, introCopy: "想看看这一口怎么走进杯子里吗？", userWords: null, normalizedTags: [] },
};

describe("RealmExperience", () => {
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUserMedia.mockReset();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 0 });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/events")) return { accepted: true, progress: progress("liquor-entry"), run: run("liquor-entry") } as never;
      if (path.endsWith("/start")) return { accepted: true, progress: progress("liquor-entry"), run: run("liquor-entry") } as never;
      if (path.endsWith("/progress")) {
        const body = JSON.parse(String(init?.body));
        const index = sceneOrder.indexOf(body.completedScene);
        return { accepted: true, progress: progress(sceneOrder[index + 1], sceneOrder.slice(0, index + 1)), run: run(sceneOrder[index + 1], sceneOrder.slice(0, index + 1)) } as never;
      }
      if (path === "/realms/duyun-maojian-mist-bud") return detail as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("falls back to pointer, advances on server confirmation and gives gentle bud feedback", async () => {
    render(<RealmExperience realmId="duyun-maojian-mist-bud" replay={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "进入茶境" }));
    await screen.findByRole("button", { name: "轻触茶汤" });

    const startCall = vi.mocked(authenticated).mock.calls.find(([path]) => String(path).endsWith("/start"));
    expect(JSON.parse(String(startCall?.[1]?.body))).toMatchObject({ interactionMode: "pointer", fallbackReason: "desktop" });
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "轻触茶汤" }));
    const mist = await screen.findByRole("group", { name: "拨开雾层" });
    fireEvent.keyDown(mist, { key: "Enter" });
    fireEvent.keyDown(mist, { key: "Enter" });
    fireEvent.keyDown(mist, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "山出现了" }));

    await screen.findByRole("heading", { name: "哪一片，会成为毛尖？" });
    fireEvent.keyDown(screen.getByRole("button", { name: "只有一枚芽" }), { key: "Enter" });
    expect(screen.getByText("这个还嫩了点。")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "一芽一叶" }), { key: "Enter" });
    expect(screen.getByRole("button", { name: "一芽一叶" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "一芽一叶" })).toHaveClass("chosen");
    expect(await screen.findByText("1 / 53,000+", { exact: false })).toBeInTheDocument();
    await waitFor(() => expect(authenticated).toHaveBeenCalledWith(expect.stringContaining("/progress"), expect.anything()));
  });

  it("loads liquor assets from the Realm response and only advances once after a repeated tap", async () => {
    const { container } = render(<RealmExperience realmId="duyun-maojian-mist-bud" replay={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "进入茶境" }));
    const button = await screen.findByRole("button", { name: "轻触茶汤" });

    expect(screen.getByRole("img", { name: "生成的茶汤交互示意" })).toHaveAttribute("src", "/media/liquor_base.webp");
    expect(container.querySelector(".realm-liquor-ripple")).toHaveAttribute("src", "/media/liquor_ripple.webp");
    fireEvent.click(button);
    fireEvent.click(button);

    await screen.findByRole("group", { name: "拨开雾层" });
    const progressCalls = vi.mocked(authenticated).mock.calls.filter(([path, init]) => String(path).endsWith("/progress") && init?.method === "PATCH");
    expect(progressCalls).toHaveLength(1);
    expect(JSON.parse(String(progressCalls[0][1]?.body))).toMatchObject({ completedScene: "liquor-entry" });
  });

  it("stays on the current scene after an API failure and can retry", async () => {
    let progressAttempts = 0;
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/realms/duyun-maojian-mist-bud") return detail as never;
      if (path.endsWith("/events")) return { accepted: true, progress: progress("liquor-entry"), run: run("liquor-entry") } as never;
      if (path.endsWith("/start")) return { accepted: true, progress: progress("liquor-entry"), run: run("liquor-entry") } as never;
      if (path.endsWith("/progress")) {
        progressAttempts += 1;
        if (progressAttempts === 1) throw new Error("茶境进度保存失败");
        const body = JSON.parse(String(init?.body));
        const index = sceneOrder.indexOf(body.completedScene);
        return { accepted: true, progress: progress(sceneOrder[index + 1], sceneOrder.slice(0, index + 1)), run: run(sceneOrder[index + 1], sceneOrder.slice(0, index + 1)) } as never;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<RealmExperience realmId="duyun-maojian-mist-bud" replay={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "进入茶境" }));
    fireEvent.click(await screen.findByRole("button", { name: "轻触茶汤" }));
    expect(await screen.findByText("茶境进度保存失败")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "杯中起雾" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "轻触茶汤" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "在这一幕再试一次" }));
    fireEvent.click(screen.getByRole("button", { name: "轻触茶汤" }));
    await screen.findByRole("group", { name: "拨开雾层" });
    expect(progressAttempts).toBe(2);
  });

  it.each([
    ["granted", "orientation", undefined],
    ["denied", "pointer", "permission_denied"],
  ] as const)("handles iOS orientation permission %s", async (permission, expectedMode, expectedFallback) => {
    const requestPermission = vi.fn().mockResolvedValue(permission);
    class OrientationEventMock extends Event {}
    Object.defineProperty(OrientationEventMock, "requestPermission", { value: requestPermission });
    Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: OrientationEventMock });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });

    render(<RealmExperience realmId="duyun-maojian-mist-bud" replay={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "进入茶境" }));
    await screen.findByRole("button", { name: "轻触茶汤" });
    const startCall = vi.mocked(authenticated).mock.calls.find(([path]) => String(path).endsWith("/start"));
    const body = JSON.parse(String(startCall?.[1]?.body));
    expect(body.interactionMode).toBe(expectedMode);
    expect(body.fallbackReason).toBe(expectedFallback);
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("prioritizes reduced motion without requesting orientation", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    class OrientationEventMock extends Event {}
    Object.defineProperty(OrientationEventMock, "requestPermission", { value: requestPermission });
    Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: OrientationEventMock });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });

    render(<RealmExperience realmId="duyun-maojian-mist-bud" replay={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "进入茶境" }));
    await screen.findByRole("button", { name: "轻触茶汤" });
    const startCall = vi.mocked(authenticated).mock.calls.find(([path]) => String(path).endsWith("/start"));
    expect(JSON.parse(String(startCall?.[1]?.body))).toMatchObject({ interactionMode: "reducedMotion", fallbackReason: "reduced_motion" });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("reviews a completed previous scene locally and exits to the tea source", async () => {
    const resumed = {
      ...detail,
      progress: progress("pick-bud", ["liquor-entry", "mist-mountain"]),
      run: run("pick-bud", ["liquor-entry", "mist-mountain"]),
    };
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/realms/duyun-maojian-mist-bud") return resumed as never;
      if (path.endsWith("/events")) return { accepted: true, progress: resumed.progress, run: resumed.run } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<RealmExperience realmId="duyun-maojian-mist-bud" replay={false} entry="tea" origin="profile" sourceTeaId="duyun-maojian" />);
    expect(await screen.findByRole("heading", { name: "哪一片，会成为毛尖？" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "退出茶境并返回茶详情" })).toHaveAttribute("href", "/tea/duyun-maojian?origin=profile");

    fireEvent.click(screen.getByRole("button", { name: "返回上一幕" }));
    expect(await screen.findByRole("heading", { name: "雾后是黔南的山" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "山出现了" }));
    expect(await screen.findByRole("heading", { name: "哪一片，会成为毛尖？" })).toBeInTheDocument();
    expect(vi.mocked(authenticated).mock.calls.filter(([path, init]) => String(path).endsWith("/progress") && init?.method === "PATCH")).toHaveLength(0);
  });

  it("disables previous-scene navigation while the frontier is being saved", async () => {
    const resumed = {
      ...detail,
      progress: progress("pick-bud", ["liquor-entry", "mist-mountain"]),
      run: run("pick-bud", ["liquor-entry", "mist-mountain"]),
    };
    let resolveProgress: ((value: unknown) => void) | undefined;
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/realms/duyun-maojian-mist-bud") return resumed as never;
      if (path.endsWith("/events")) return { accepted: true, progress: resumed.progress, run: resumed.run } as never;
      if (path.endsWith("/progress")) return new Promise((resolve) => { resolveProgress = resolve; }) as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<RealmExperience realmId="duyun-maojian-mist-bud" replay={false} />);
    await screen.findByRole("heading", { name: "哪一片，会成为毛尖？" });
    fireEvent.keyDown(screen.getByRole("button", { name: "一芽一叶" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "把它带去锅边" }));
    expect(screen.getByRole("button", { name: "返回上一幕" })).toBeDisabled();
    resolveProgress?.({ accepted: true, progress: progress("wok-craft", ["liquor-entry", "mist-mountain", "pick-bud"]), run: run("wok-craft", ["liquor-entry", "mist-mountain", "pick-bud"]) });
    expect(await screen.findByRole("heading", { name: "让鲜叶慢慢成为茶" })).toBeInTheDocument();
  });
});
