import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceExperience } from "./VoiceExperience";
import { authenticated } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
}));

describe("VoiceExperience", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("permission denied")) },
    });
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/voice/sessions") return {
        voiceSessionId: "voice-1", providerMode: "browser_mock", status: "prepared",
        expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。", rtc: null,
      } as never;
      if (path === "/voice/sessions/voice-1/start") return {
        voiceSessionId: "voice-1", providerMode: "browser_mock", status: "active",
        expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。", rtc: null,
      } as never;
      if (path === "/voice/sessions/voice-1/turns") return { acceptedCount: 1 } as never;
      if (path === "/voice/sessions/voice-1/stop") return {
        status: "completed",
        experienceCompleted: true,
        journey: { teaId: "duyun-maojian", brewed: true, tasted: true, realmId: "duyun-maojian-mist-bud", realmCompleted: false, nextStep: "realm" },
        tasteResult: { userWords: "像青草，后面有点甜", normalizedTags: ["fresh", "aftertaste_sweetness"], explanation: "接近清鲜与回甘。", providerMode: "server_mock", tasteProfile: {}, passportEntry: {} },
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("falls back to labeled text-capable demo mode when microphone access is denied", async () => {
    render(<VoiceExperience teaId="duyun-maojian" mode="taste" />);
    fireEvent.click(screen.getByRole("button", { name: "开启麦克风，开始陪伴" }));
    expect(await screen.findByText("演示模式 · 正在陪伴")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("也可以直接输入你想说的话…"), { target: { value: "像青草，后面有点甜" } });
    fireEvent.click(screen.getByRole("button", { name: "发送文字" }));
    expect(screen.getByText("像青草，后面有点甜")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "结束并保存" }));
    expect(await screen.findByText("你的话，已经变成茶语。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /进入《雾里一芽》/ })).toHaveAttribute("href", "/realm/duyun-maojian-mist-bud");
    await waitFor(() => expect(authenticated).toHaveBeenCalledWith("/voice/sessions/voice-1/turns", expect.anything()));
  });

  it("does not claim a taste was saved when the user confirms no words", async () => {
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/voice/sessions") return { voiceSessionId: "voice-2", providerMode: "browser_mock", status: "prepared", expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。", rtc: null } as never;
      if (path === "/voice/sessions/voice-2/start") return { voiceSessionId: "voice-2", providerMode: "browser_mock", status: "active", expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。", rtc: null } as never;
      if (path === "/voice/sessions/voice-2/stop") return { status: "completed", experienceCompleted: false, journey: { teaId: "duyun-maojian", brewed: true, tasted: false, realmId: "duyun-maojian-mist-bud", realmCompleted: false, nextStep: "taste" }, tasteResult: null } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<VoiceExperience teaId="duyun-maojian" mode="taste" />);
    fireEvent.click(screen.getByRole("button", { name: "开启麦克风，开始陪伴" }));
    await screen.findByText("演示模式 · 正在陪伴");
    fireEvent.click(screen.getByRole("button", { name: "结束并保存" }));
    expect(await screen.findByText("还没有留下品饮原话。")).toBeInTheDocument();
    expect(screen.queryByText("你的话，已经变成茶语。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /补充一句感受/ })).toBeInTheDocument();
  });
});
