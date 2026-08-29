import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { publicRequest } from "@/lib/api";
import { PublicProfileView } from "./PublicProfileView";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api", () => ({
  publicRequest: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
  mediaUrl: (path: string) => path,
}));

const visual = { url: "/media/tea", objectPosition: "50% 50%", structureColor: "#abc", abstractForm: "line", atmosphereCue: "mist", overlay: {} };
const tea = { teaId: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南", teaType: "绿茶", professionalTags: ["鲜爽"], translation: "鲜爽", visual };
const profile = {
  publicId: "public-id",
  publicBlockIds: ["IDENTITY", "MY_TEA"],
  identity: { displayName: "山边喝茶的人", bio: "喜欢清鲜，也喜欢慢慢回甘。", teaBti: { state: "early", code: "FLSE", personaName: "山雾漫游者", personaSummary: "清鲜、轻盈，追着香气认识新茶", axes: { freshMellow: .4, lightRich: .2, scentTaste: .1, explorerComfort: 1 }, evidence: [] } },
  myTea: tea,
  myWords: null,
  teaPassport: null,
  updatedAt: "2026-08-28T10:00:00Z",
};

describe("PublicProfileView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicRequest).mockImplementation(async (path: string) => {
      if (path === "/public/profiles/public-id") return profile as never;
      if (path.endsWith("/events")) return { accepted: true } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("shows only public blocks and attributes CTA before forced onboarding", async () => {
    render(<PublicProfileView publicId="public-id" />);
    expect(await screen.findByRole("heading", { name: "山边喝茶的人" })).toBeInTheDocument();
    expect(screen.getByText("清鲜、轻盈，追着香气认识新茶")).toBeInTheDocument();
    expect(screen.getByLabelText("Tea-BTI 四轴")).toHaveTextContent("F清鲜M醇和L轻盈R浓郁S香气先行T滋味先行E尝新C守味");
    expect(screen.getByText("都匀毛尖")).toBeInTheDocument();
    expect(screen.queryByText("我怎么说这一口")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始我的三杯 →" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/?fromProfile=public-id"));
    const eventCalls = vi.mocked(publicRequest).mock.calls.filter(([path]) => path.endsWith("/events"));
    expect(eventCalls).toHaveLength(2);
    expect(JSON.parse(String(eventCalls[1][1]?.body))).toMatchObject({ eventType: "profile_cta_started" });
  });
});
