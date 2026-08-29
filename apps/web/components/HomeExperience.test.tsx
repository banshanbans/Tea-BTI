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
    window.localStorage.clear();
    useAppStore.setState({ swipeCount: 0, mbti: null });
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
          name: `测试茶 ${index + 1}`, region: "贵州", tags: ["清香"], visual,
        })),
      } as never;
      if (path.startsWith("/feed")) return {
        items: [{ cardId: "opaque-card", headline: "先凭感觉", body: "不露出茶的身份", tags: ["轻盈"], scene: "早晨", visual }],
      } as never;
      if (path === "/swipes") return {
        accepted: true,
        tasteProfile: { vector: {}, sampleCount: 1, confidenceState: "forming" },
        recommendationReady: false,
        recommendation: null,
        reveal: { teaId: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南", teaType: "绿茶", professionalTags: ["鲜爽"], translation: "你留下了鲜爽的方向", visual },
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("completes MBTI seed, blind swipe and reveal without frontend tea mapping", async () => {
    render(<HomeExperience />);
    fireEvent.click(await screen.findByRole("button", { name: /开始刷茶/ }));
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "INFP" }));
    expect(await screen.findByText("测试茶 1")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "先看看" }));
    expect(screen.getByText(/Taste Vector/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /开始刷茶，让推荐变准/ }));
    expect(await screen.findByRole("heading", { name: "先凭感觉" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "想喝" }));
    expect(await screen.findByText("都匀毛尖")).toBeInTheDocument();
    expect(screen.getByText("你刚刚喜欢的是")).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: /开始刷茶/ }));
    expect(await screen.findByRole("heading", { name: /你的 MBTI/ })).toBeInTheDocument();
    expect(screen.getByText(/不会清空你原来的记录/)).toBeInTheDocument();
    expect(authenticated).not.toHaveBeenCalledWith(expect.stringContaining("/feed"));
    expect(useAppStore.getState().swipeCount).toBe(7);
  });

  it("shows a short brand transition and automatically resumes returning users in the feed", async () => {
    window.localStorage.setItem("tea-bti.launchSeen", "1");
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/bootstrap") return {
        userId: "returning-user", mbti: "INFP", onboardingCompleted: true, swipeCount: 8,
        recommendationReady: true, tasteProfile: { vector: {}, sampleCount: 8, confidenceState: "early" },
        capabilities: { voice: "mock", tasteNormalization: "mock", missingConfig: [] },
      } as never;
      if (path.startsWith("/feed")) return {
        items: [{ cardId: "restored-card", headline: "继续凭感觉", body: "服务端恢复的卡片", tags: ["清甜"], scene: "午后", visual }],
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<HomeExperience />);
    expect(await screen.findByText("Tea-BTI")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /开始刷茶/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "继续凭感觉" }, { timeout: 1600 })).toBeInTheDocument();
    expect(useAppStore.getState().swipeCount).toBe(8);
  });
});
