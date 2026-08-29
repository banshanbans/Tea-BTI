import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authenticated } from "@/lib/api";
import { ProfileView } from "./ProfileView";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,qr") } }));
vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
  mediaUrl: (path: string) => path,
}));

const visual = { url: "/media/tea", objectPosition: "50% 50%", structureColor: "#abc", abstractForm: "line", atmosphereCue: "mist", overlay: {} };
const tea = { teaId: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南", teaType: "绿茶", professionalTags: ["鲜爽", "嫩香"], translation: "鲜爽", visual };
const initialProfile = {
  settings: {
    displayName: "雾里喝茶的人", bio: "在清鲜和回甘之间，慢慢找到自己的这一杯。", selectedTeaId: tea.teaId,
    sourceFeedbackId: "feedback-1", publicQuote: "像雨后打开的窗，尾巴有一点甜。",
    publicBlockIds: ["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"], updatedAt: "2026-08-28T10:00:00Z",
  },
  blocks: [
    { blockId: "IDENTITY", title: "我是谁", isPublic: true, isComplete: true },
    { blockId: "MY_TEA", title: "我的本命茶", isPublic: true, isComplete: true },
    { blockId: "MY_WORDS", title: "我的原话", isPublic: true, isComplete: true },
    { blockId: "TEA_PASSPORT", title: "茶护照", isPublic: true, isComplete: true },
  ],
  teaBti: {
    state: "early", code: "FLSE", personaName: "山雾漫游者", personaSummary: "清鲜、轻盈，追着香气认识新茶", formationProgress: null,
    axes: { freshMellow: 0.4, lightRich: 0.2, scentTaste: 0.1, explorerComfort: 1 }, evidence: ["已完成 5 次刷茶"],
  },
  selectedTea: tea,
  teaCandidates: [{ tea, evidenceReasons: ["刷茶时喜欢过", "已进入茶护照"], evidenceScore: 3 }],
  quoteCandidates: [{ feedbackId: "feedback-1", tea, text: "像雨后的青草，尾巴有一点甜", normalizedTags: ["fresh", "sweet"], infusionNumber: 2 }],
  passport: { items: [{ tea, saved: false, brewed: false, tasted: true, realmUnlocked: false, favoriteInfusion: 2, userDescription: "像雨后的青草", normalizedTags: ["fresh"], firstDrunkAt: "2026-08-28T09:00:00Z", realmCompletedAt: null, specimens: [{ specimenId: "one" }], updatedAt: "2026-08-28T09:00:00Z" }] },
  share: { active: false, publicId: null, publicPath: null, createdAt: null, revokedAt: null },
};

describe("ProfileView", () => {
  const clipboard = { writeText: vi.fn(async () => undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/me/profile" && !init) return initialProfile as never;
      if (path === "/me/profile/events") return { accepted: true } as never;
      if (path === "/me/profile" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return { accepted: true, profile: { ...initialProfile, settings: { ...initialProfile.settings, publicBlockIds: body.publicBlockIds } } } as never;
      }
      if (path === "/me/profile/share" && init?.method === "POST") return {
        accepted: true,
        share: { active: true, publicId: "public-128-bit-id", publicPath: "/p/public-128-bit-id", createdAt: "2026-08-28T10:00:00Z", revokedAt: null },
        publicProfile: null,
      } as never;
      if (path === "/me/profile/share" && init?.method === "DELETE") return {
        accepted: true,
        share: { active: false, publicId: null, publicPath: null, createdAt: "2026-08-28T10:00:00Z", revokedAt: "2026-08-28T10:05:00Z" },
        publicProfile: null,
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("makes Tea-BTI the only hero and renders three quiet evidence forms", async () => {
    const { container } = render(<ProfileView />);
    expect(await screen.findByRole("heading", { name: "喝出来的我" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "山雾漫游者" })).toBeInTheDocument();
    expect(screen.getByText("Tea-BTI · FLSE")).toBeInTheDocument();
    expect(screen.getByText("清鲜、轻盈，追着香气认识新茶")).toBeInTheDocument();
    expect(screen.getByLabelText("Tea-BTI 四轴")).toHaveTextContent("清鲜醇和轻盈浓郁香气滋味尝新守味");
    expect(screen.getByLabelText(/S 香气先行到T 滋味先行/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查看我的人格解读/ })).toHaveAttribute("href", "/profile/tea-bti");

    expect(screen.queryByText("雾里喝茶的人")).not.toBeInTheDocument();
    expect(screen.queryByText(/在清鲜和回甘之间/)).not.toBeInTheDocument();
    expect(screen.queryByText("IDENTITY")).not.toBeInTheDocument();
    expect(screen.queryByText("公开", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("私密", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Next Tea", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Unlisted Share", { exact: true })).not.toBeInTheDocument();

    expect(container.querySelectorAll(".profile-signature-tea")).toHaveLength(1);
    expect(screen.getByText(/像雨后打开的窗/)).toBeInTheDocument();
    expect(screen.getAllByText("1", { selector: ".profile-passport-trace strong" })).toHaveLength(3);
    expect(screen.getByRole("link", { name: /我的收藏/ })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: /我的收藏/ })).toHaveTextContent("0 款茶");
    expect(screen.getByRole("link", { name: /去刷茶/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "编辑茶主页" })).toHaveAttribute("href", "/profile/edit");
  });

  it("edits share scope in the top sheet, then creates and revokes one link", async () => {
    render(<ProfileView />);
    await screen.findByText("山雾漫游者");
    fireEvent.click(screen.getByRole("button", { name: "分享 Tea-BTI" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Tea-BTI 身份/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Tea-BTI 身份/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /我说过/ }));
    expect(screen.getByTestId("profile-share-preview")).not.toHaveTextContent("像雨后打开的窗");

    fireEvent.click(screen.getByRole("button", { name: "确认范围并生成链接" }));
    await waitFor(() => expect(screen.getByAltText("公开茶主页二维码")).toBeInTheDocument());
    const updateCall = vi.mocked(authenticated).mock.calls.find(([path, init]) => path === "/me/profile" && init?.method === "PUT");
    expect(JSON.parse(String(updateCall?.[1]?.body)).publicBlockIds).toEqual(["IDENTITY", "MY_TEA", "TEA_PASSPORT"]);
    expect(vi.mocked(authenticated).mock.calls.filter(([path, init]) => path === "/me/profile/share" && init?.method === "POST")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "复制链接" }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/p/public-128-bit-id")));
    fireEvent.click(screen.getByRole("button", { name: "撤销并让旧链接失效" }));
    expect(await screen.findByText("旧链接已经收起")).toBeInTheDocument();
  });

  it("shows an exact combined action while Tea-BTI is forming", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/me/profile") return {
        ...initialProfile,
        teaBti: {
          ...initialProfile.teaBti,
          state: "forming", code: null, personaName: null, personaSummary: null,
          formationProgress: { swipesCompleted: 1, swipesRequired: 2, swipesRemaining: 1, positiveSignalCompleted: false },
        },
      } as never;
      if (path === "/me/profile/events") return { accepted: true } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<ProfileView />);
    expect(await screen.findByText("身份正在形成 · 再留下 1 次选择，就会初步形成")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /身份正在形成/ })).toHaveAttribute("href", "/");
  });

  it("updates an active share in place without generating a second link", async () => {
    const activeShare = { active: true, publicId: "existing-public-id", publicPath: "/p/existing-public-id", createdAt: "2026-08-28T10:00:00Z", revokedAt: null };
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/me/profile" && !init) return { ...initialProfile, share: activeShare } as never;
      if (path === "/me/profile/events") return { accepted: true } as never;
      if (path === "/me/profile" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return { accepted: true, profile: { ...initialProfile, share: activeShare, settings: { ...initialProfile.settings, publicBlockIds: body.publicBlockIds } } } as never;
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<ProfileView />);
    await screen.findByText("山雾漫游者");
    fireEvent.click(screen.getByRole("button", { name: "分享 Tea-BTI" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /本命茶/ }));
    fireEvent.click(screen.getByRole("button", { name: "更新分享范围" }));
    expect(await screen.findByText("分享范围已更新")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /localhost.*existing-public-id/ })).toHaveAttribute("href", "http://localhost:3000/p/existing-public-id");
    expect(vi.mocked(authenticated).mock.calls.filter(([path, init]) => path === "/me/profile/share" && init?.method === "POST")).toHaveLength(0);
  });
});
