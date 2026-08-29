import { describe, expect, it, vi } from "vitest";

import { parseTlvFrames, RtcVoiceClient, stableTurnId } from "./rtc";

function tlv(type: string, value: string): Uint8Array {
  const payload = new TextEncoder().encode(value);
  const result = new Uint8Array(8 + payload.length);
  result.set(new TextEncoder().encode(type), 0);
  new DataView(result.buffer).setUint32(4, payload.length, false);
  result.set(payload, 8);
  return result;
}

describe("RTC transport helpers", () => {
  it("parses multiple TLV frames and sliced Uint8Array input", () => {
    const first = tlv("subv", JSON.stringify({ data: [] }));
    const second = tlv("conv", JSON.stringify({ Stage: { Code: 1 } }));
    const wrapped = new Uint8Array(3 + first.length + second.length + 2);
    wrapped.set(first, 3);
    wrapped.set(second, 3 + first.length);
    expect(parseTlvFrames(wrapped.subarray(3, 3 + first.length + second.length))).toEqual([
      { type: "subv", value: JSON.stringify({ data: [] }) },
      { type: "conv", value: JSON.stringify({ Stage: { Code: 1 } }) },
    ]);
  });

  it("rejects truncated TLV input", () => {
    expect(() => parseTlvFrames(new Uint8Array([1, 2, 3]))).toThrow("header is incomplete");
    expect(() => parseTlvFrames(tlv("subv", "hello").subarray(0, 10))).toThrow("payload is incomplete");
  });

  it("derives stable transcript ids and prefers provider ids", () => {
    const data = { text: "有一点回甘", startTime: 10, endTime: 20 };
    expect(stableTurnId(data, "user", "有一点回甘")).toBe(stableTurnId(data, "user", "有一点回甘"));
    expect(stableTurnId({ ...data, paragraphId: "paragraph-7" }, "user", "有一点回甘")).toBe("rtc-paragraph-7");
  });

  it("stops capture before draining and leaving the room", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const client = new RtcVoiceClient() as any;
    client.engine = {
      stopAudioCapture: vi.fn(async () => { order.push("capture"); }),
      leaveRoom: vi.fn(async () => { order.push("leave"); }),
    };
    client.vertc = { destroyEngine: vi.fn(() => { order.push("destroy"); }) };
    const pending = client.stopCaptureAndDrain();
    await vi.advanceTimersByTimeAsync(500);
    client.lastFinalTurnAt = Date.now();
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual(["capture"]);
    await vi.advanceTimersByTimeAsync(200);
    await pending;
    expect(order).toEqual(["capture", "leave", "destroy"]);
    vi.useRealTimers();
  });
});
