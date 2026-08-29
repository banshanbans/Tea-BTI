import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authenticated } from "@/lib/api";
import { TEA_BTI_ENDPOINT_COPY, teaBtiStatusCopy } from "@/lib/tea-bti";
import { TeaBtiDetailView } from "./TeaBtiDetailView";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,qr") } }));
vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
}));

const codes = [
  "FLSE", "FLSC", "FLTE", "FLTC", "FRSE", "FRSC", "FRTE", "FRTC",
  "MLSE", "MLSC", "MLTE", "MLTC", "MRSE", "MRSC", "MRTE", "MRTC",
];

const tea = {
  teaId: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南", teaType: "绿茶",
  professionalTags: ["鲜爽"], personalityKeywords: ["清鲜"], translation: "清鲜",
  visual: { url: "/media/tea", objectPosition: "50% 50%", structureColor: "#abc", abstractForm: "line", atmosphereCue: "mist", overlay: {} },
};

const personaDetail = {
  punchline: "一杯还没喝明白，已经想知道下一杯是什么了。",
  symptoms: ["茶还没入口，先闻半天。", "别人问好喝吗，你先说好闻。", "喝过的茶还想换个天气再试。", "看到新茶会多看一眼。", "愿意给细微变化留点时间。"],
  contrasts: [
    { claim: "我只是喜欢清淡", reality: "你对厚重会先观察一会儿" },
    { claim: "我很随和", reality: "你的鼻子有自己的意见" },
    { claim: "我会慢慢喝", reality: "下一款已经进入视线" },
    { claim: "我不挑", reality: "你只是不急着说出口" },
  ],
  scenes: [1, 2, 3].map((index) => ({ title: `小剧场 ${index}`, lines: [{ speaker: "朋友", text: "再来一泡？" }, { speaker: "你", text: "可以，下一款也看看。" }] })),
  enemies: [1, 2, 3].map((index) => ({ trigger: `今天只喝这一款 ${index}`, reaction: "先让我看看茶单。" })),
  signatureMoment: [{ speaker: "你", text: "这个好香。" }, { speaker: "朋友", text: "你喝了吗？" }, { speaker: "你", text: "还没。" }],
  neverSay: "今天我们只喝这一款。",
  chemistry: {
    partnerCode: "MRTC", partnerName: "炉火守夜人",
    lines: [{ speaker: "你", text: "换一杯？" }, { speaker: "炉火守夜人", text: "这一杯才第三泡。" }],
    summary: "一个负责发现世界，一个负责让这一杯多待一会儿。",
  },
};

function profile(code: string | null, state: "forming" | "early" | "stable" = "early") {
  return {
    state,
    code,
    personaName: code ? `人格 ${code}` : null,
    personaSummary: code ? "当前人格的简短气质" : null,
    formationProgress: state === "forming" ? { swipesCompleted: 3, swipesRequired: 5, swipesRemaining: 2, positiveSignalCompleted: false } : null,
    personaDetail: code ? personaDetail : null,
    behaviorEvidence: code ? [{ kind: "drink", tea, userWords: "像雨后的青草。", infusionNumber: 2 }] : [],
    axes: { freshMellow: -0.5, lightRich: 0.6, scentTaste: -0.7, explorerComfort: 0.8 },
    evidence: ["已完成 5 次刷茶", "已留下真实喜欢"],
  };
}

describe("TeaBtiDetailView", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(codes)("renders every current code %s with the complete fixed template and no atlas", async (code) => {
    vi.mocked(authenticated).mockResolvedValue(profile(code) as never);
    render(<TeaBtiDetailView />);
    expect((await screen.findAllByText(`Tea-BTI · ${code}`)).length).toBeGreaterThan(0);
    expect(screen.getByText(`人格 ${code}`)).toBeInTheDocument();
    expect(screen.getByText("你可能有这些茶桌习惯")).toBeInTheDocument();
    expect(screen.getByText("你以为 / 实际上")).toBeInTheDocument();
    expect(screen.getByText("坐到茶桌上的你")).toBeInTheDocument();
    expect(screen.getByText("听见这些话，你会停顿一下")).toBeInTheDocument();
    expect(screen.getByText("你遇见「炉火守夜人」")).toBeInTheDocument();
    code.split("").forEach((letter) => {
      expect(screen.getAllByText(new RegExp(`^${letter} ·`)).length).toBeGreaterThan(0);
      expect(screen.getByText(TEA_BTI_ENDPOINT_COPY[letter])).toBeInTheDocument();
    });
    expect(screen.queryByText("16 型图鉴")).not.toBeInTheDocument();
  });

  it.each([["early", "初见"], ["stable", "逐渐稳定"]] as const)("uses the %s status language and changing CTA", async (state, label) => {
    vi.mocked(authenticated).mockResolvedValue(profile("FLSE", state) as never);
    render(<TeaBtiDetailView />);
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /继续刷，看看你会不会变/ })).toHaveAttribute("href", "/");
  });

  it("keeps forming state independent and hides every guessed persona section", async () => {
    vi.mocked(authenticated).mockResolvedValue(profile(null, "forming") as never);
    render(<TeaBtiDetailView />);
    expect(await screen.findByText("待形成")).toBeInTheDocument();
    expect(screen.getByText("身份正在形成 · 再留下 2 次选择，并留一次喜欢、收藏或真实品饮")).toBeInTheDocument();
    expect(screen.queryByText("你可能有这些茶桌习惯")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("四轴人格解读")).not.toBeInTheDocument();
    expect(screen.queryByText(/茶桌 CP/)).not.toBeInTheDocument();
    expect(screen.getByText("再留下几次选择，这里会出现只属于你的线索。")).toBeInTheDocument();
  });

  it("shows structured real evidence and an empty-evidence fallback", async () => {
    vi.mocked(authenticated).mockResolvedValue(profile("FLSE") as never);
    const { unmount } = render(<TeaBtiDetailView />);
    expect(await screen.findByText("为什么最近是这个人格")).toBeInTheDocument();
    expect(screen.getByText("都匀毛尖")).toBeInTheDocument();
    expect(screen.getByText("“像雨后的青草。”")).toBeInTheDocument();
    expect(screen.getByText("第 2 泡")).toBeInTheDocument();
    unmount();

    vi.mocked(authenticated).mockResolvedValue({ ...profile("FLSE"), behaviorEvidence: [] } as never);
    render(<TeaBtiDetailView />);
    expect(await screen.findByText("再留下几次选择，这里会出现只属于你的线索。")).toBeInTheDocument();
  });

  it("opens the shared profile sheet from the top action", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/me/tea-bti") return profile("FLSE") as never;
      if (path === "/me/profile") return {
        settings: { displayName: "雾里喝茶的人", bio: "", selectedTeaId: null, sourceFeedbackId: null, publicQuote: null, publicBlockIds: ["IDENTITY"], updatedAt: "2026-08-29T00:00:00Z" },
        blocks: [{ blockId: "IDENTITY", title: "我是谁", isPublic: true, isComplete: true }],
        teaBti: profile("FLSE"), selectedTea: null, teaCandidates: [], quoteCandidates: [], passport: { items: [] },
        share: { active: false, publicId: null, publicPath: null, createdAt: null, revokedAt: null },
      } as never;
      throw new Error(`Unexpected path ${path}`);
    });
    render(<TeaBtiDetailView />);
    await screen.findByText("人格 FLSE");
    fireEvent.click(screen.getByRole("button", { name: "分享 Tea-BTI" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("这次想分享什么")).toBeInTheDocument();
  });

  it("combines both formation conditions without hiding either requirement", () => {
    expect(teaBtiStatusCopy(profile(null, "forming") as never)).toBe("身份正在形成 · 再留下 2 次选择，并留一次喜欢、收藏或真实品饮");
    expect(teaBtiStatusCopy({ ...profile(null, "forming"), formationProgress: { swipesCompleted: 5, swipesRequired: 5, swipesRemaining: 0, positiveSignalCompleted: false } } as never)).toBe("身份正在形成 · 留下一次喜欢、收藏或真实品饮");
    expect(teaBtiStatusCopy({ ...profile(null, "forming"), formationProgress: { swipesCompleted: 2, swipesRequired: 5, swipesRemaining: 3, positiveSignalCompleted: true } } as never)).toBe("身份正在形成 · 再留下 3 次选择会更清晰");
  });
});
