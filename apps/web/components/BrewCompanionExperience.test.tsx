import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrewCompanionExperience } from "./BrewCompanionExperience";
import { authenticated } from "@/lib/api";

const rtcMocks = vi.hoisted(() => ({
  connect: vi.fn(), disconnect: vi.fn(), pauseCapture: vi.fn(), resumeCapture: vi.fn(), stopCaptureAndDrain: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authenticated: vi.fn(),
  authenticatedBinary: vi.fn(),
  abortVoiceSessionBestEffort: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }),
}));

vi.mock("@/lib/rtc", () => ({
  RtcVoiceClient: class {
    connect = rtcMocks.connect;
    disconnect = rtcMocks.disconnect;
    pauseCapture = rtcMocks.pauseCapture;
    resumeCapture = rtcMocks.resumeCapture;
    stopCaptureAndDrain = rtcMocks.stopCaptureAndDrain;
  },
}));

const tea = {
  id: "duyun-maojian",
  name: "都匀毛尖",
  brewingGuide: {
    vessel: "玻璃杯或盖碗", temperatureRange: "80–85°C", teaAmount: "3g", waterVolume: "150ml",
  },
};

function state(overrides: Record<string, unknown> = {}) {
  return {
    runId: "run-1", status: "active", teaId: "duyun-maojian", vessel: "玻璃杯",
    temperatureC: 82, temperatureRange: "80–85°C", teaAmount: "3g", waterVolumeMl: 150,
    currentStage: "prepare", infusionNumber: 1, maxInfusions: 3, plannedDurationSeconds: 60,
    timerStartedAt: null, deadlineAt: null, remainingSeconds: null, pendingVisionEvent: null,
    cameraEnabled: false, isMatcha: false, adjustmentMessage: null, completedInfusions: [],
    ...overrides,
  };
}

function session(status: "prepared" | "active", brewState = state()) {
  return {
    voiceSessionId: "brew-voice-1", providerMode: "browser_mock", status,
    expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    welcomeMessage: "我们先这样泡，第一口喝完我再跟着你调。茶具摆好了吗？",
    rtc: null, brewState,
  };
}

describe("BrewCompanionExperience", () => {
  beforeEach(() => {
    window.localStorage.clear();
    rtcMocks.connect.mockReset();
    rtcMocks.disconnect.mockReset().mockResolvedValue(undefined);
    rtcMocks.pauseCapture.mockReset().mockResolvedValue(undefined);
    rtcMocks.resumeCapture.mockReset().mockResolvedValue(undefined);
    rtcMocks.stopCaptureAndDrain.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("permission denied")) },
    });
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/teas/duyun-maojian") return tea as never;
      if (path === "/voice/sessions") return session("prepared") as never;
      if (path === "/voice/sessions/brew-voice-1/start") return session("active") as never;
      if (path === "/voice/sessions/brew-voice-1/brew/events") {
        const body = JSON.parse(String(init?.body));
        const next = body.stage || "prepare";
        return { accepted: true, message: `进入 ${next}`, brewState: state({ currentStage: next }) } as never;
      }
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("falls back to voice-only without blocking when camera and microphone are denied", async () => {
    render(<BrewCompanionExperience teaId="duyun-maojian" />);
    expect(await screen.findByRole("heading", { name: "都匀毛尖" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始陪泡" }));

    expect(await screen.findByText("语音陪泡中")).toBeInTheDocument();
    expect(screen.getByText("第 1 / 3 泡")).toBeInTheDocument();
    expect(screen.queryByText(/通用建议|标准泡法/)).not.toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    const createCall = vi.mocked(authenticated).mock.calls.find(([path]) => path === "/voice/sessions");
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      mode: "brew", teaId: "duyun-maojian", cameraEnabled: false,
      brewSetup: { vessel: "玻璃杯", waterVolumeMl: 150 },
    });
  });

  it("keeps an absolute deadline visible and extends it through an idempotent event", async () => {
    const deadline = new Date(Date.now() + 15_000).toISOString();
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/teas/duyun-maojian") return tea as never;
      if (path === "/voice/sessions") return session("prepared", state({ currentStage: "steep", deadlineAt: deadline })) as never;
      if (path === "/voice/sessions/brew-voice-1/start") return session("active", state({ currentStage: "steep", deadlineAt: deadline })) as never;
      if (path.endsWith("/brew/events")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ eventType: "timer_adjust", seconds: 5 });
        return { accepted: true, message: "计时已延长 5 秒。", brewState: state({ currentStage: "steep", plannedDurationSeconds: 65, deadlineAt: new Date(Date.now() + 20_000).toISOString() }) } as never;
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<BrewCompanionExperience teaId="duyun-maojian" />);
    await screen.findByRole("heading", { name: "都匀毛尖" });
    fireEvent.click(screen.getByRole("button", { name: "开始陪泡" }));
    expect(await screen.findByText(/00:1[45]/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /5秒/ }));
    expect(await screen.findByText("计时已延长 5 秒。")).toBeInTheDocument();
  });

  it("shows a restored visual candidate but advances only after explicit confirmation", async () => {
    const pending = state({ currentStage: "add_leaves", pendingVisionEvent: "leaves_present", cameraEnabled: true });
    vi.mocked(authenticated).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/teas/duyun-maojian") return tea as never;
      if (path === "/voice/sessions") return session("prepared", pending) as never;
      if (path === "/voice/sessions/brew-voice-1/start") return session("active", pending) as never;
      if (path.endsWith("/brew/events")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ eventType: "confirm_stage", source: "camera_confirmed", stage: "pour" });
        return { accepted: true, message: "进入注水", brewState: state({ currentStage: "pour" }) } as never;
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<BrewCompanionExperience teaId="duyun-maojian" />);
    await screen.findByRole("heading", { name: "都匀毛尖" });
    fireEvent.click(screen.getByRole("button", { name: "开始陪泡" }));
    expect(await screen.findByText("我看到像是已经投茶，要进入注水吗？")).toBeInTheDocument();
    expect(screen.getByText("投茶", { selector: ".stage.active" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "对" }));
    await waitFor(() => expect(screen.getByText("注水", { selector: ".stage.active" })).toBeInTheDocument());
  });

  it("recovers the server stage after refresh before reconnecting capture", async () => {
    window.localStorage.setItem("tea-bti.brew-session.duyun-maojian", "saved-brew");
    const recovered = state({ currentStage: "steep", infusionNumber: 2, deadlineAt: new Date(Date.now() + 25_000).toISOString() });
    vi.mocked(authenticated).mockImplementation(async (path: string) => {
      if (path === "/teas/duyun-maojian") return tea as never;
      if (path === "/voice/sessions/saved-brew/brew-state") return recovered as never;
      if (path === "/voice/sessions/saved-brew/start") return {
        ...session("active", recovered), voiceSessionId: "saved-brew",
      } as never;
      throw new Error(`Unexpected path: ${path}`);
    });
    render(<BrewCompanionExperience teaId="duyun-maojian" />);
    expect((await screen.findAllByRole("button", { name: "恢复上次陪泡" })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "恢复上次陪泡" })[0]);
    expect(await screen.findByText("第 2 / 3 泡")).toBeInTheDocument();
    expect(screen.getByText("浸泡", { selector: ".stage.active" })).toBeInTheDocument();
    expect(vi.mocked(authenticated).mock.calls.some(([path]) => path === "/voice/sessions")).toBe(false);
  });
});
