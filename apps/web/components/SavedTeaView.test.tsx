import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { authenticated } from "@/lib/api";
import { SavedTeaView } from "./SavedTeaView";

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  mediaUrl: (path: string) => path,
}));

const tea = (teaId: string, name: string) => ({
  tea: { teaId, name, region: "贵州", teaType: "绿茶", translation: "清鲜", professionalTags: [], visual: { url: `/${teaId}.jpg`, objectPosition: "50% 50%", structureColor: "#315c42", abstractForm: "leaf", atmosphereCue: "mist", overlay: {} } },
  saved: teaId === "saved", brewed: false, tasted: false, realmUnlocked: false, favoriteInfusion: null, userDescription: null, normalizedTags: [], firstDrunkAt: null, realmCompletedAt: null, specimens: [], updatedAt: "2026-08-30T00:00:00Z",
});

describe("SavedTeaView", () => {
  it("shows only saved teas and links back to the private tea detail", async () => {
    vi.mocked(authenticated).mockResolvedValue({ items: [tea("saved", "都匀毛尖"), tea("other", "湄潭翠芽")] } as never);
    render(<SavedTeaView />);
    expect(await screen.findByRole("heading", { name: "我的收藏" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /都匀毛尖/ })).toHaveAttribute("href", "/tea/saved?origin=profile");
    expect(screen.queryByText("湄潭翠芽")).not.toBeInTheDocument();
  });
});
