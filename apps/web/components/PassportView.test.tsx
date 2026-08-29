import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PassportView } from "./PassportView";
import { authenticated } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  mediaUrl: (path: string) => path,
}));

describe("PassportView journey handoff", () => {
  it("closes the tea memory loop into Tea-BTI and the next tea", async () => {
    vi.mocked(authenticated).mockResolvedValue({
      items: [{
        tea: { teaId: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南", teaType: "绿茶", professionalTags: ["清鲜"], translation: "清鲜", visual: { url: "/tea.jpg", objectPosition: "50% 50%", structureColor: "#315c42", abstractForm: "leaf", atmosphereCue: "mist", overlay: {} } },
        saved: false, brewed: true, tasted: true, realmUnlocked: true, favoriteInfusion: 2,
        userDescription: "像雨后的青草", normalizedTags: ["fresh"], firstDrunkAt: "2026-08-29T00:00:00Z",
        realmCompletedAt: "2026-08-29T00:05:00Z", specimens: [], updatedAt: "2026-08-29T00:05:00Z",
      }],
    } as never);
    render(<PassportView />);
    expect(await screen.findByRole("link", { name: /看看我的 Tea-BTI/ })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "继续刷下一杯" })).toHaveAttribute("href", "/");
  });
});
