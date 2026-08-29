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
  settings: { displayName: "一位喝茶的人", bio: "", selectedTeaId: null, sourceFeedbackId: null, publicQuote: null, publicBlockIds: ["IDENTITY"], updatedAt: "2026-08-28T10:00:00Z" },
  blocks: [
    { blockId: "IDENTITY", title: "我是谁", isPublic: true, isComplete: true },
    { blockId: "MY_TEA", title: "我的本命茶", isPublic: false, isComplete: false },
    { blockId: "MY_WORDS", title: "我的原话", isPublic: false, isComplete: false },
    { blockId: "TEA_PASSPORT", title: "茶护照", isPublic: false, isComplete: true },
  ],
  teaBti: { state: "early", code: "FLSE", personaName: "山雾漫游者", axes: { freshMellow: 0.4, lightRich: 0.2, scentTaste: 0.1, explorerComfort: 1 }, evidence: ["已完成 5 次刷茶"] },
  selectedTea: null,
  teaCandidates: [{ tea, evidenceReasons: ["刷茶时喜欢过", "已进入茶护照"], evidenceScore: 3 }],
  quoteCandidates: [{ feedbackId: "feedback-1", tea, text: "像雨后的青草，尾巴有一点甜", normalizedTags: ["fresh", "sweet"], infusionNumber: 2 }],
  passport: { items: [{ tea, saved: false, brewed: false, tasted: true, realmUnlocked: false, favoriteInfusion: 2, userDescription: "像雨后的青草", normalizedTags: ["fresh"], firstDrunkAt: "2026-08-28T09:00:00Z", realmCompletedAt: null, specimens: [], updatedAt: "2026-08-28T09:00:00Z" }] },
  share: { active: false, publicId: null, publicPath: null, createdAt: null, revokedAt: null },
} as const;

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
        return {
          accepted: true,
          profile: {
            ...initialProfile,
            settings: {
              ...initialProfile.settings,
              displayName: body.displayName,
              bio: body.bio,
              selectedTeaId: body.selectedTeaId,
              sourceFeedbackId: body.sourceFeedbackId,
              publicQuote: body.publicQuote,
              publicBlockIds: body.publicBlockIds,
            },
            selectedTea: tea,
          },
        } as never;
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

  it("edits four evidence blocks, confirms the public preview and revokes the link", async () => {
    render(<ProfileView />);
    expect(await screen.findByText("山雾漫游者")).toBeInTheDocument();
    expect(screen.getByText("正在形成。喜欢、收藏或真喝一杯后，候选才会出现。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("昵称"), { target: { value: "雾里喝茶的人" } });
    fireEvent.change(screen.getByLabelText("简介"), { target: { value: "慢慢找到自己的这一杯。" } });
    fireEvent.change(screen.getByLabelText(/只可从真实行为候选中选择/), { target: { value: tea.teaId } });
    fireEvent.change(screen.getByLabelText("原话来源"), { target: { value: "feedback-1" } });
    fireEvent.change(screen.getByLabelText(/公开版本/), { target: { value: "像雨后打开的窗，尾巴有一点甜。" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "保存四个 Block" }));

    await waitFor(() => expect(screen.getByText("茶主页已保存")).toBeInTheDocument());
    const updateCall = vi.mocked(authenticated).mock.calls.find(([path, init]) => path === "/me/profile" && init?.method === "PUT");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      displayName: "雾里喝茶的人",
      selectedTeaId: "duyun-maojian",
      sourceFeedbackId: "feedback-1",
      publicBlockIds: ["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"],
    });

    fireEvent.click(screen.getByRole("button", { name: "预览并分享" }));
    expect(screen.getByTestId("profile-share-preview")).toHaveTextContent("像雨后打开的窗");
    expect(screen.getByText("IDENTITY / 我是谁", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认公开并生成链接" }));
    expect(await screen.findByAltText("公开茶主页二维码")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "系统分享" }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/p/public-128-bit-id")));
    fireEvent.click(screen.getByRole("button", { name: "撤销并让旧链接失效" }));
    expect(await screen.findByText("旧链接已立即失效")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认公开并生成链接" })).toBeInTheDocument();
  });

  it("shows server evidence and a concrete next action while Tea-BTI is forming", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/me/profile") return { ...initialProfile, teaBti: { ...initialProfile.teaBti, state: "forming", code: null, personaName: null, evidence: ["至少完成 5 次刷茶，并留下一次真实喜欢或品饮反馈"] } } as never;
      if (path === "/me/profile/events") return { accepted: true } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<ProfileView />);
    expect(await screen.findByText("怎样让它更清晰")).toBeInTheDocument();
    expect(screen.getByText(/至少完成 5 次刷茶/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /继续刷茶，让它更清晰/ })).toHaveAttribute("href", "/");
  });
});
