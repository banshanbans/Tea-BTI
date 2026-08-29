import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeExperience } from "./HomeExperience";
import { authenticated } from "@/lib/api";
import { useAppStore } from "@/lib/store";

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
  mediaUrl: (path: string) => path,
}));

const visual = {
  url: "/media/card",
  objectPosition: "50% 50%",
  structureColor: "#abc",
  abstractForm: "line",
  atmosphereCue: "mist",
  overlay: {},
};

describe("HomeExperience", () => {
  beforeEach(() => {
    useAppStore.setState({ swipeCount: 0, mbti: null, feedResumeCardId: null });
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/bootstrap") return {
        userId: "user-1", mbti: null, onboardingCompleted: false, swipeCount: 0,
        recommendationReady: false, tasteProfile: { vector: {}, sampleCount: 0, confidenceState: "forming" },
        capabilities: { voice: "mock", tasteNormalization: "mock", missingConfig: [] },
      } as never;
      if (path === "/onboarding/seed") return {
        mbti: "INFP",
        items: ["mirror", "surprise", "contrast"].map((role, index) => ({
          role, roleLabel: role, explanation: "破冰理由", teaId: `tea-${index}`,
          name: `测试茶 ${index + 1}`, region: "贵州", tags: ["清香"], personalityKeywords: ["细致"], visual,
        })),
      } as never;
      if (path.startsWith("/feed")) return {
        items: [
          { cardId: "opaque-card", teaId: "tea-1", name: "测试绿茶", region: "贵州", teaType: "绿茶", personalityKeywords: ["灵动"], headline: "先凭感觉", body: "认识这杯茶", tags: ["轻盈"], scene: "早晨", visual },
          { cardId: "second-card", teaId: "tea-2", name: "测试红茶", region: "贵州", teaType: "红茶", personalityKeywords: ["温暖"], headline: "再看一杯", body: "认识另一杯茶", tags: ["清鲜"], scene: "午后", visual },
        ],
      } as never;
      if (path === "/swipes") return {
        accepted: true,
        tasteProfile: { vector: {}, sampleCount: 1, confidenceState: "forming" },
        recommendationReady: false,
        recommendation: null,
        reveal: { teaId: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南", teaType: "绿茶", professionalTags: ["鲜爽"], personalityKeywords: ["灵动"], translation: "你留下了鲜爽的方向", visual },
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("completes MBTI seed, identified tea swipe and reveal without frontend tea mapping", async () => {
    render(<HomeExperience />);
    expect(await screen.findByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "找到你的 MBTI" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /我知道自己的 MBTI/ }));
    expect(await screen.findByRole("heading", { name: "找到你的 MBTI" })).toBeInTheDocument();
    expect(screen.queryByText(/MBTI 只用于破冰/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "P" }));
    fireEvent.click(screen.getByRole("button", { name: /就选这个 · INFP/ }));
    expect(await screen.findByText("测试茶 1")).toBeInTheDocument();
    expect(screen.queryByText(/MBTI 只用于破冰/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
    const seedCard = screen.getByRole("button", { name: "查看测试茶 1完整茶叶卡" });
    fireEvent.pointerDown(seedCard, { pointerId: 1, clientX: 180, clientY: 360 });
    fireEvent.pointerUp(seedCard, { pointerId: 1, clientX: 180, clientY: 360 });
    expect(await screen.findByRole("dialog", { name: "测试茶 1完整茶叶卡" })).toBeInTheDocument();
    expect(screen.getByAltText("测试茶 1完整茶叶卡")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭完整茶叶卡" }));
    fireEvent.click(screen.getByRole("button", { name: "下一杯" }));
    expect(await screen.findByText("测试茶 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始刷茶" }));
    expect(await screen.findByRole("heading", { name: "先凭感觉" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getAllByText("测试绿茶 · 绿茶").length).toBeGreaterThan(0);
    const feedCard = screen.getByRole("button", { name: "查看测试绿茶完整茶叶卡" });
    fireEvent.pointerDown(feedCard, { pointerId: 2, clientX: 180, clientY: 360 });
    fireEvent.pointerUp(feedCard, { pointerId: 2, clientX: 180, clientY: 360 });
    expect(await screen.findByRole("dialog", { name: "测试绿茶完整茶叶卡" })).toBeInTheDocument();
    expect(screen.getByAltText("测试绿茶完整茶叶卡")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭完整茶叶卡" }));
    fireEvent.click(screen.getByRole("button", { name: "这杯想喝" }));
    expect(await screen.findByText("都匀毛尖")).toBeInTheDocument();
    expect(screen.getByText("这一杯是")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭茶叶揭晓" }));
    expect(await screen.findByRole("heading", { name: "再看一杯" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "这杯想喝" }));
    expect(await screen.findByText("这一杯是")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续刷" }));
    expect(await screen.findByRole("heading", { name: "先凭感觉" })).toBeInTheDocument();
    await waitFor(() => expect(authenticated).toHaveBeenCalledWith("/swipes", expect.anything()));
  });

  it("reopens the three-cup icebreaker from a shared profile without clearing existing state", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/bootstrap") return {
        userId: "existing-user", mbti: "INFP", onboardingCompleted: true, swipeCount: 7,
        recommendationReady: true, tasteProfile: { vector: { freshness: .7 }, sampleCount: 7, confidenceState: "early" },
        capabilities: { voice: "mock", tasteNormalization: "mock", missingConfig: [] },
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<HomeExperience forceOnboarding />);
    expect(await screen.findByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /我知道自己的 MBTI/ }));
    expect(await screen.findByRole("heading", { name: "找到你的 MBTI" })).toBeInTheDocument();
    expect(screen.getByText(/你原来的记录都在/)).toBeInTheDocument();
    expect(authenticated).not.toHaveBeenCalledWith(expect.stringContaining("/feed"));
    expect(useAppStore.getState().swipeCount).toBe(7);
  });

  it("resumes returning users directly in the feed without an intermediate brand page", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/bootstrap") return {
        userId: "returning-user", mbti: "INFP", onboardingCompleted: true, swipeCount: 8,
        recommendationReady: true, tasteProfile: { vector: {}, sampleCount: 8, confidenceState: "early" },
        capabilities: { voice: "mock", tasteNormalization: "mock", missingConfig: [] },
      } as never;
      if (path.startsWith("/feed")) return {
        items: [{ cardId: "restored-card", teaId: "tea-1", name: "测试茶", region: "贵州", teaType: "绿茶", personalityKeywords: ["可靠"], headline: "继续凭感觉", body: "服务端恢复的卡片", tags: ["清甜"], scene: "午后", visual }],
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<HomeExperience />);
    expect(screen.queryByText("正在摆好三杯茶")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "继续凭感觉" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" })).not.toBeInTheDocument();
    expect(useAppStore.getState().swipeCount).toBe(8);
  });

  it("restores the next card kept in memory after returning from a detail route", async () => {
    useAppStore.setState({ feedResumeCardId: "second-card" });
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/bootstrap") return {
        userId: "returning-user", mbti: "INFP", onboardingCompleted: true, swipeCount: 3,
        recommendationReady: false, tasteProfile: { vector: {}, sampleCount: 3, confidenceState: "forming" },
        capabilities: { voice: "mock", tasteNormalization: "mock", missingConfig: [] },
      } as never;
      if (path.startsWith("/feed")) return {
        items: [
          { cardId: "first-card", teaId: "tea-1", name: "第一杯", region: "贵州", teaType: "绿茶", personalityKeywords: ["轻盈"], headline: "第一张", body: "第一杯", tags: ["清鲜"], scene: "早晨", visual },
          { cardId: "second-card", teaId: "tea-2", name: "第二杯", region: "贵州", teaType: "红茶", personalityKeywords: ["温暖"], headline: "接着这一张", body: "第二杯", tags: ["温润"], scene: "午后", visual },
        ],
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<HomeExperience />);
    expect(await screen.findByRole("heading", { name: "接着这一张" }, { timeout: 1600 })).toBeInTheDocument();
  });

  it("changes each MBTI axis independently with keyboard and keeps a skip path", async () => {
    render(<HomeExperience />);
    fireEvent.click(await screen.findByRole("button", { name: /我知道自己的 MBTI/ }));
    const energyWheel = screen.getByRole("listbox", { name: "能量维度" });
    expect(screen.getAllByRole("listbox")).toHaveLength(4);
    fireEvent.keyDown(energyWheel, { key: "ArrowUp" });
    fireEvent.click(screen.getByRole("option", { name: "S" }));
    fireEvent.click(screen.getByRole("option", { name: "T" }));
    fireEvent.click(screen.getByRole("option", { name: "P" }));
    expect(screen.getByRole("button", { name: /就选这个 · ESTP/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "还不知道？直接看茶叶卡" }));
    await waitFor(() => expect(authenticated).toHaveBeenCalledWith("/onboarding/seed", expect.objectContaining({ body: JSON.stringify({ mbti: null }) })));
    expect(await screen.findByRole("heading", { name: "先凭感觉" })).toBeInTheDocument();
    expect(screen.queryByText("测试茶 1")).not.toBeInTheDocument();
  });

  it("returns from the three-cup results to the preserved MBTI selection", async () => {
    render(<HomeExperience />);
    fireEvent.click(await screen.findByRole("button", { name: /我知道自己的 MBTI/ }));
    fireEvent.click(screen.getByRole("option", { name: "P" }));
    fireEvent.click(screen.getByRole("button", { name: /就选这个 · INFP/ }));
    await screen.findByText("测试茶 1");
    fireEvent.click(screen.getByRole("button", { name: "返回 MBTI 选择" }));
    expect(await screen.findByRole("button", { name: /就选这个 · INFP/ })).toBeInTheDocument();
    expect(screen.queryByText("测试茶 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" })).not.toBeInTheDocument();
  });

  it("opens with the background inert, focuses the primary action and sends unknown MBTI directly to the feed", async () => {
    const { container } = render(<HomeExperience />);
    const dialog = await screen.findByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" });
    const primary = screen.getByRole("button", { name: /我知道自己的 MBTI/ });
    await waitFor(() => expect(primary).toHaveFocus());
    expect(container.querySelector(".onboarding-screen")).toHaveAttribute("inert");
    expect(container.querySelector(".onboarding-screen")).toHaveAttribute("aria-hidden", "true");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "还不知道，直接看茶叶卡" }));
    expect(await screen.findByRole("heading", { name: "先凭感觉" })).toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(screen.queryByText("测试茶 1")).not.toBeInTheDocument();
    expect(authenticated).toHaveBeenCalledWith("/onboarding/seed", expect.objectContaining({ body: JSON.stringify({ mbti: null }) }));
    expect(authenticated).toHaveBeenCalledWith("/feed?limit=8");
  });

  it.each([
    ["主按钮", () => fireEvent.click(screen.getByRole("button", { name: /我知道自己的 MBTI/ }))],
    ["关闭按钮", () => fireEvent.click(document.querySelector(".onboarding-choice-close") as HTMLElement)],
    ["遮罩", () => fireEvent.click(document.querySelector(".onboarding-choice-backdrop") as HTMLElement)],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
  ])("%s closes the choice dialog without seeding", async (_label, dismiss) => {
    render(<HomeExperience />);
    await screen.findByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" });
    dismiss();
    const energyWheel = await screen.findByRole("listbox", { name: "能量维度" });
    await waitFor(() => expect(energyWheel).toHaveFocus());
    expect(authenticated).not.toHaveBeenCalledWith("/onboarding/seed", expect.anything());
  });

  it("keeps a failed direct-feed request in the dialog and retries in place", async () => {
    let seedAttempts = 0;
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/bootstrap") return {
        userId: "user-1", mbti: null, onboardingCompleted: false, swipeCount: 0,
        recommendationReady: false, tasteProfile: { vector: {}, sampleCount: 0, confidenceState: "forming" },
        capabilities: { voice: "mock", tasteNormalization: "mock", missingConfig: [] },
      } as never;
      if (path === "/onboarding/seed") {
        seedAttempts += 1;
        if (seedAttempts === 1) throw new Error("not ready");
        return { mbti: null, items: [] } as never;
      }
      if (path.startsWith("/feed")) return { items: [{ cardId: "retry-card", teaId: "tea-1", name: "重试茶", region: "贵州", teaType: "绿茶", personalityKeywords: ["清醒"], headline: "重试成功", body: "茶叶卡已就绪", tags: ["清鲜"], scene: "早晨", visual }] } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<HomeExperience />);
    fireEvent.click(await screen.findByRole("button", { name: "还不知道，直接看茶叶卡" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("茶叶卡还没准备好，再试一次。");
    expect(screen.getByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "还不知道，直接看茶叶卡" }));
    expect(await screen.findByRole("heading", { name: "重试成功" })).toBeInTheDocument();
    expect(seedAttempts).toBe(2);
  });

  it("lets a shared visitor choose cards without clearing an already completed onboarding record", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/bootstrap") return {
        userId: "existing-user", mbti: "INFP", onboardingCompleted: true, swipeCount: 7,
        recommendationReady: true, tasteProfile: { vector: { freshness: .7 }, sampleCount: 7, confidenceState: "early" },
        capabilities: { voice: "mock", tasteNormalization: "mock", missingConfig: [] },
      } as never;
      if (path.startsWith("/feed")) return { items: [{ cardId: "shared-card", teaId: "tea-1", name: "保留记录的茶", region: "贵州", teaType: "绿茶", personalityKeywords: ["清醒"], headline: "继续探索", body: "原记录还在", tags: ["清鲜"], scene: "早晨", visual }] } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<HomeExperience forceOnboarding />);
    fireEvent.click(await screen.findByRole("button", { name: "还不知道，直接看茶叶卡" }));
    expect(await screen.findByRole("heading", { name: "继续探索" })).toBeInTheDocument();
    expect(authenticated).not.toHaveBeenCalledWith("/onboarding/seed", expect.anything());
    expect(useAppStore.getState().swipeCount).toBe(7);
  });
});
