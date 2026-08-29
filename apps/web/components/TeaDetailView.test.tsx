import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeaDetailView } from "./TeaDetailView";
import { authenticated } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
  mediaUrl: (path: string) => path,
}));

const visual = { url: "/tea.jpg", objectPosition: "50% 50%", structureColor: "#315c42", abstractForm: "leaf", atmosphereCue: "mist", overlay: {} };
const base = {
  teaId: "duyun-maojian",
  name: "都匀毛尖",
  region: "贵州 · 黔南",
  teaType: "绿茶",
  professionalTags: ["清鲜"],
  personalityKeywords: ["灵动", "敏锐", "清醒"],
  translation: "清鲜的方向",
  visual,
  detailVisual: { url: "/detail.jpg", objectPosition: "50% 50%", alt: "都匀毛尖实拍参考图", rightsState: "unknown", rightsNote: "演示素材", credit: "来源页", sourceUrl: "https://example.com/photo" },
  representativeFeatures: "条索紧细卷曲，白毫明显。",
  aromaAndTaste: "清嫩香气高而持久，入口鲜爽。",
  officialDescription: "经过审核的茶品资料。",
  process: ["杀青"],
  brewingGuide: { vessel: "盖碗", temperatureRange: "80–85°C", teaAmount: "3g", waterVolume: "150ml", method: "玻璃杯冲泡", steepTime: "15–20 秒", notes: ["以包装说明为准"] },
  evidenceRefIds: [],
  evidenceRefs: [{ id: "source", label: "公开来源", url: "https://example.com/source", supports: ["外形"] }],
  realmId: "duyun-maojian-mist-bud",
};

describe("TeaDetailView guided journey", () => {
  beforeEach(() => vi.mocked(authenticated).mockReset());

  it.each([
    ["brew", false, false, false, "开始陪泡", "/brew/duyun-maojian?origin=swipe"],
    ["taste", true, false, false, "说出这一口", "/taste/duyun-maojian?origin=swipe"],
    ["realm", true, true, false, "进入《雾里一芽》", "/realm/duyun-maojian-mist-bud?entry=tea&teaId=duyun-maojian&origin=swipe"],
    ["passport", true, true, true, "查看茶护照", "/passport"],
  ] as const)("renders the %s stage as the single primary next step", async (nextStep, brewed, tasted, realmCompleted, label, href) => {
    vi.mocked(authenticated).mockResolvedValue({ ...base, journey: { teaId: base.teaId, brewed, tasted, realmId: base.realmId, realmCompleted, nextStep } } as never);
    render(<TeaDetailView teaId={base.teaId} />);
    const primary = await screen.findByRole("link", { name: new RegExp(label) });
    expect(primary).toHaveAttribute("href", href);
    expect(screen.getByText("顺着喝，也可以随时去茶境看看。")).toBeInTheDocument();
    expect(screen.getByAltText("都匀毛尖实拍参考图")).toHaveAttribute("src", "/detail.jpg");
    expect(screen.getByText("条索紧细卷曲，白毫明显。")).toBeInTheDocument();
    for (const heading of ["代表特点", "香气与滋味", "性格关键词", "冲泡建议"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.queryByText(/性格关键词只用于探索与破冰/)).not.toBeInTheDocument();
    expect(screen.getByText("查看公开来源与图片边界")).toBeInTheDocument();
  });

  it.each([
    ["swipe", "返回刷茶", "/"],
    ["passport", "返回茶护照", "/passport"],
    ["profile", "返回喝出来的我", "/profile"],
  ] as const)("returns the %s origin to its deterministic destination", async (origin, label, href) => {
    vi.mocked(authenticated).mockResolvedValue({ ...base, journey: { teaId: base.teaId, brewed: false, tasted: false, realmId: base.realmId, realmCompleted: false, nextStep: "brew" } } as never);
    render(<TeaDetailView teaId={base.teaId} origin={origin} />);
    expect(await screen.findByRole("link", { name: label })).toHaveAttribute("href", href);
  });
});
