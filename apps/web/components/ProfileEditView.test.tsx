import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authenticated } from "@/lib/api";
import { ProfileEditView } from "./ProfileEditView";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
}));

const tea = {
  teaId: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南", teaType: "绿茶", professionalTags: ["鲜爽"], translation: "鲜爽",
  visual: { url: "/tea", objectPosition: "50% 50%", structureColor: "#abc", abstractForm: "line", atmosphereCue: "mist", overlay: {} },
};
const profile = {
  settings: { displayName: "一位喝茶的人", bio: "", selectedTeaId: null, sourceFeedbackId: null, publicQuote: null, publicBlockIds: ["IDENTITY", "TEA_PASSPORT"], updatedAt: "2026-08-28T10:00:00Z" },
  blocks: [
    { blockId: "IDENTITY", title: "我是谁", isPublic: true, isComplete: true },
    { blockId: "MY_TEA", title: "我的本命茶", isPublic: false, isComplete: false },
    { blockId: "MY_WORDS", title: "我的原话", isPublic: false, isComplete: false },
    { blockId: "TEA_PASSPORT", title: "茶护照", isPublic: true, isComplete: true },
  ],
  teaBti: { state: "forming", code: null, personaName: null, personaSummary: null, formationProgress: { swipesCompleted: 1, swipesRequired: 2, swipesRemaining: 1, positiveSignalCompleted: false }, axes: {}, evidence: [] },
  selectedTea: null,
  teaCandidates: [{ tea, evidenceReasons: ["刷茶时喜欢过"], evidenceScore: 2 }],
  quoteCandidates: [{ feedbackId: "feedback-1", tea, text: "像雨后的青草，尾巴有一点甜", normalizedTags: ["fresh"], infusionNumber: 2 }],
  passport: { items: [{ tea, saved: true, brewed: false, tasted: false, realmUnlocked: false, favoriteInfusion: null, userDescription: null, normalizedTags: [], firstDrunkAt: null, realmCompletedAt: null, specimens: [], updatedAt: "2026-08-28T09:00:00Z" }] },
  share: { active: false, publicId: null, publicPath: null, createdAt: null, revokedAt: null },
};

describe("ProfileEditView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/me/profile" && !init) return profile as never;
      if (path === "/me/profile" && init?.method === "PUT") return { accepted: true, profile } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("refills, enables complete evidence, saves consumer-facing visibility and returns", async () => {
    render(<ProfileEditView />);
    expect(await screen.findByRole("heading", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByLabelText("昵称")).toHaveValue("一位喝茶的人");
    expect(screen.getByLabelText("简介")).toHaveValue("");
    expect(screen.getByRole("link", { name: "取消编辑并返回" })).toHaveAttribute("href", "/profile");

    const identity = screen.getByRole("checkbox", { name: /Tea-BTI 身份/ });
    const myTea = screen.getByRole("checkbox", { name: /本命茶/ });
    const myWords = screen.getByRole("checkbox", { name: /我说过/ });
    expect(identity).toBeChecked();
    expect(identity).toBeDisabled();
    expect(myTea).toBeDisabled();
    expect(myWords).toBeDisabled();

    fireEvent.change(screen.getByLabelText("昵称"), { target: { value: "雾里喝茶的人" } });
    fireEvent.change(screen.getByLabelText("简介"), { target: { value: "慢慢找到自己的这一杯。" } });
    fireEvent.change(screen.getByLabelText("本命茶", { selector: "select" }), { target: { value: tea.teaId } });
    expect(myTea).not.toBeDisabled();
    fireEvent.click(myTea);
    fireEvent.change(screen.getByLabelText("我说过", { selector: "select" }), { target: { value: "feedback-1" } });
    expect(screen.getByLabelText("公开版本")).toHaveValue("像雨后的青草，尾巴有一点甜");
    expect(myWords).not.toBeDisabled();
    fireEvent.click(myWords);
    fireEvent.change(screen.getByLabelText("公开版本"), { target: { value: "像雨后打开的窗。" } });

    fireEvent.click(screen.getByRole("button", { name: "保存茶主页" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
    const updateCall = vi.mocked(authenticated).mock.calls.find(([path, init]) => path === "/me/profile" && init?.method === "PUT");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      displayName: "雾里喝茶的人",
      bio: "慢慢找到自己的这一杯。",
      selectedTeaId: tea.teaId,
      sourceFeedbackId: "feedback-1",
      publicQuote: "像雨后打开的窗。",
      publicBlockIds: ["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"],
    });
  });

  it("keeps the editor open with a readable failure message", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/me/profile" && !init) return profile as never;
      throw new Error("save failed");
    });
    render(<ProfileEditView />);
    await screen.findByRole("heading", { name: "编辑" });
    fireEvent.click(screen.getByRole("button", { name: "保存茶主页" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("这次修改还没收好，再试一次。");
    expect(push).not.toHaveBeenCalled();
  });
});
