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
  translation: "清鲜的方向",
  visual,
  officialDescription: "经过审核的茶品资料。",
  process: ["杀青"],
  brewingGuide: { vessel: "盖碗", temperatureRange: "80–85°C", steepTime: "15–20 秒", notes: ["以包装说明为准"] },
  evidenceRefIds: [],
  realmId: "duyun-maojian-mist-bud",
};

describe("TeaDetailView guided journey", () => {
  beforeEach(() => vi.mocked(authenticated).mockReset());

  it.each([
    ["brew", false, false, false, "开始陪泡", "/brew/duyun-maojian"],
    ["taste", true, false, false, "说出这一口", "/taste/duyun-maojian"],
    ["realm", true, true, false, "进入《雾里一芽》", "/realm/duyun-maojian-mist-bud"],
    ["passport", true, true, true, "查看茶护照", "/passport"],
  ] as const)("renders the %s stage as the single primary next step", async (nextStep, brewed, tasted, realmCompleted, label, href) => {
    vi.mocked(authenticated).mockResolvedValue({ ...base, journey: { teaId: base.teaId, brewed, tasted, realmId: base.realmId, realmCompleted, nextStep } } as never);
    render(<TeaDetailView teaId={base.teaId} />);
    const primary = await screen.findByRole("link", { name: new RegExp(label) });
    expect(primary).toHaveAttribute("href", href);
    expect(screen.getByText("推荐按顺序体验，但不会锁住你。茶境随时可以进入。")).toBeInTheDocument();
  });
});
