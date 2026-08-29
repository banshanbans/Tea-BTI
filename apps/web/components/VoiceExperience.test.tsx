import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceExperience } from "./VoiceExperience";
import { abortVoiceSessionBestEffort, authenticated } from "@/lib/api";

const rtcMocks = vi.hoisted(() => ({ connect: vi.fn(), disconnect: vi.fn(), stopCaptureAndDrain: vi.fn() }));

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
  abortVoiceSessionBestEffort: vi.fn(),
}));

vi.mock("@/lib/rtc", () => ({
  RtcVoiceClient: class {
    connect = rtcMocks.connect;
    disconnect = rtcMocks.disconnect;
    stopCaptureAndDrain = rtcMocks.stopCaptureAndDrain;
  },
}));

describe("VoiceExperience", () => {
  beforeEach(() => {
    rtcMocks.connect.mockReset();
    rtcMocks.disconnect.mockReset().mockResolvedValue(undefined);
    rtcMocks.stopCaptureAndDrain.mockReset().mockResolvedValue(undefined);
    vi.mocked(abortVoiceSessionBestEffort).mockReset();
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
      if (path === "/voice/sessions/voice-1/context") return {
        voiceSessionId: "voice-1", providerMode: "browser_mock", status: "active",
        expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。", rtc: null,
      } as never;
      if (path === "/voice/sessions/voice-1/stop") return {
        status: "completed",
        experienceCompleted: true,
        journey: { teaId: "duyun-maojian", brewed: true, tasted: true, realmId: "duyun-maojian-mist-bud", realmCompleted: false, nextStep: "realm" },
        tasteResult: { userWords: "像青草，后面有点甜", normalizedTags: ["fresh", "aftertaste_sweetness"], explanation: "接近清鲜与回甘。", providerMode: "server_mock", tasteProfile: {}, passportEntry: {} },
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("releases a prepared real session when microphone connection fails", async () => {
    rtcMocks.connect.mockRejectedValue(new Error("permission timeout"));
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/voice/sessions") return {
        voiceSessionId: "voice-real", providerMode: "volcengine_rtc", status: "prepared",
        expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。",
        rtc: { appId: "rtc-app", roomId: "room-1", userId: "user-1", token: "short-lived" },
      } as never;
      if (path === "/voice/sessions/voice-real/abort") return { status: "cancelled" } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<VoiceExperience teaId="duyun-maojian" mode="brew" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));

    expect(await screen.findByText("麦克风没有接上。检查浏览器权限后再试。")).toBeInTheDocument();
    expect(authenticated).toHaveBeenCalledWith("/voice/sessions/voice-real/abort", expect.anything());
    expect(screen.getByRole("button", { name: "打开麦克风" })).toBeEnabled();
  });

  it("falls back to labeled text-capable demo mode when microphone access is denied", async () => {
    render(<VoiceExperience teaId="duyun-maojian" mode="taste" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));
    expect(await screen.findByText("演示模式 · 正在陪伴")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("也可以写下这一口…"), { target: { value: "像青草，后面有点甜" } });
    fireEvent.click(screen.getByRole("button", { name: "发送文字" }));
    expect(screen.getByText("像青草，后面有点甜")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "结束并保存" }));
    expect(await screen.findByText("这句话，收好了。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /进入《雾里一芽》/ })).toHaveAttribute("href", "/realm/duyun-maojian-mist-bud?entry=tea&teaId=duyun-maojian&origin=swipe");
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
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));
    await screen.findByText("演示模式 · 正在陪伴");
    fireEvent.click(screen.getByRole("button", { name: "结束并保存" }));
    expect(await screen.findByText("还想听你说一句。")).toBeInTheDocument();
    expect(screen.queryByText("这句话，收好了。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /补充一句感受/ })).toBeInTheDocument();
  });

  it("sends typed text into the real companion context", async () => {
    const realSession = {
      voiceSessionId: "voice-real-text", providerMode: "volcengine_rtc", status: "prepared",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。",
      rtc: { appId: "rtc-app", roomId: "room-1", userId: "user-1", token: "short-lived", agentUserId: "tea_companion" },
    };
    rtcMocks.connect.mockResolvedValue(undefined);
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/voice/sessions") return realSession as never;
      if (path === "/voice/sessions/voice-real-text/start") return { ...realSession, status: "active" } as never;
      if (path === "/voice/sessions/voice-real-text/turns") return { acceptedCount: 1 } as never;
      if (path === "/voice/sessions/voice-real-text/context") return { ...realSession, status: "active" } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    const view = render(<VoiceExperience teaId="duyun-maojian" mode="taste" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));
    await screen.findByText("实时语音已连接");
    fireEvent.change(screen.getByPlaceholderText("也可以写下这一口…"), { target: { value: "入口很轻，后面有点甜" } });
    fireEvent.click(screen.getByRole("button", { name: "发送文字" }));

    await waitFor(() => expect(authenticated).toHaveBeenCalledWith(
      "/voice/sessions/voice-real-text/context",
      expect.objectContaining({ body: JSON.stringify({ userText: "入口很轻，后面有点甜" }) }),
    ));
    view.unmount();
    expect(abortVoiceSessionBestEffort).toHaveBeenCalledWith("voice-real-text");
  });

  it("drains final RTC subtitles before stopping and saves the selected infusion", async () => {
    const order: string[] = [];
    const realSession = {
      voiceSessionId: "voice-drain", providerMode: "volcengine_rtc", status: "prepared",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。",
      rtc: { appId: "rtc-app", roomId: "room-1", userId: "user-1", token: "short-lived", agentUserId: "tea_companion" },
    };
    rtcMocks.connect.mockResolvedValue(undefined);
    rtcMocks.stopCaptureAndDrain.mockImplementation(async () => { order.push("drain"); });
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/voice/sessions") return realSession as never;
      if (path === "/voice/sessions/voice-drain/start") return { ...realSession, status: "active" } as never;
      if (path === "/voice/sessions/voice-drain/stop") {
        order.push("stop");
        expect(init?.body).toBe(JSON.stringify({ infusionNumber: 2 }));
        return { status: "completed", experienceCompleted: false, journey: { teaId: "duyun-maojian", brewed: false, tasted: false, realmId: null, realmCompleted: false, nextStep: "passport" }, tasteResult: null } as never;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<VoiceExperience teaId="duyun-maojian" mode="brew" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));
    await screen.findByText("实时语音已连接");
    fireEvent.click(screen.getByRole("button", { name: "下一泡" }));
    fireEvent.click(screen.getByRole("button", { name: "先停在这里" }));
    await screen.findByText("还差最后一步。");
    expect(order).toEqual(["drain", "stop"]);
  });

  it("rejoins an active real session with a fresh token after a fatal RTC error", async () => {
    const realSession = {
      voiceSessionId: "voice-reconnect", providerMode: "volcengine_rtc", status: "prepared",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "先说说这一口。",
      rtc: { appId: "rtc-app", roomId: "room-1", userId: "user-1", token: "token-1", agentUserId: "tea_companion" },
    };
    rtcMocks.connect
      .mockImplementationOnce(async (_session, _onTurn, _onStatus, onFatal) => { onFatal("实时语音发生错误，可以重新连接或结束本次陪伴。"); })
      .mockResolvedValueOnce(undefined);
    let startCount = 0;
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/voice/sessions") return realSession as never;
      if (path === "/voice/sessions/voice-reconnect/start") {
        startCount += 1;
        return { ...realSession, status: "active", rtc: { ...realSession.rtc, token: `token-${startCount + 1}` } } as never;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<VoiceExperience teaId="duyun-maojian" mode="taste" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));
    expect(await screen.findByRole("button", { name: "重新连接实时语音" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新连接实时语音" }));
    await waitFor(() => expect(rtcMocks.connect).toHaveBeenCalledTimes(2));
    expect(startCount).toBe(2);
    expect(rtcMocks.connect.mock.calls[1][0].rtc.token).toBe("token-3");
  });

  it("sends the selected infusion with brew stage changes", async () => {
    render(<VoiceExperience teaId="duyun-maojian" mode="brew" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));
    await screen.findByText("演示模式 · 正在陪伴");
    fireEvent.click(screen.getByRole("button", { name: "下一泡" }));
    fireEvent.click(screen.getByRole("button", { name: "温杯" }));
    await waitFor(() => expect(authenticated).toHaveBeenCalledWith(
      "/voice/sessions/voice-1/context",
      expect.objectContaining({ body: JSON.stringify({ brewStage: "warm_vessel", infusionNumber: 2 }) }),
    ));
  });

  it("ends a stale server session and recreates after refresh", async () => {
    let createCount = 0;
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/voice/sessions") {
        createCount += 1;
        if (createCount === 1) {
          throw Object.assign(new Error("已有进行中的语音会话"), {
            code: "VOICE_SESSION_ACTIVE",
            details: { voiceSessionId: "voice-stale" },
          });
        }
        return { voiceSessionId: "voice-new", providerMode: "browser_mock", status: "prepared", expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "又见面了。", rtc: null } as never;
      }
      if (path === "/voice/sessions/voice-stale/abort") return { status: "cancelled" } as never;
      if (path === "/voice/sessions/voice-new/start") return { voiceSessionId: "voice-new", providerMode: "browser_mock", status: "active", expiresAt: new Date(Date.now() + 60_000).toISOString(), welcomeMessage: "又见面了。", rtc: null } as never;
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<VoiceExperience teaId="duyun-maojian" mode="brew" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));

    expect(await screen.findByText("演示模式 · 正在陪伴")).toBeInTheDocument();
    expect(authenticated).toHaveBeenCalledWith("/voice/sessions/voice-stale/abort", expect.anything());
    expect(createCount).toBe(2);
  });

  it("does not create a second session when automatic takeover fails", async () => {
    let createCount = 0;
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/voice/sessions") {
        createCount += 1;
        throw Object.assign(new Error("已有进行中的语音会话"), {
          code: "VOICE_SESSION_ACTIVE",
          details: { voiceSessionId: "voice-still-running" },
        });
      }
      if (path === "/voice/sessions/voice-still-running/abort") {
        throw Object.assign(new Error("上一段实时语音尚未结束"), { code: "VOICE_ABORT_FAILED" });
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<VoiceExperience teaId="duyun-maojian" mode="brew" />);
    fireEvent.click(screen.getByRole("button", { name: "打开麦克风" }));
    expect(await screen.findByText("上一段实时语音尚未结束，请稍后重试。")).toBeInTheDocument();
    expect(createCount).toBe(1);
  });
});
