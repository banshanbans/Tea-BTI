import type { VoiceSession } from "./api";

export type TranscriptTurn = { clientTurnId: string; role: "user" | "assistant"; text: string };
export type RtcConnectionState =
  | "checking" | "joining" | "connected" | "listening" | "thinking" | "speaking"
  | "reconnecting" | "lost" | "error" | "closed";

const RTC_PERMISSION_TIMEOUT_MS = 15_000;
const RTC_CONNECTION_TIMEOUT_MS = 20_000;
const RTC_RECONNECT_TIMEOUT_MS = 15_000;
const FINAL_TURN_QUIET_MS = 600;
const FINAL_TURN_MAX_WAIT_MS = 2_500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

type BinaryMessage = ArrayBuffer | Uint8Array;

export function parseTlvFrames(message: BinaryMessage): Array<{ type: string; value: string }> {
  const bytes = message instanceof Uint8Array
    ? new Uint8Array(message.buffer, message.byteOffset, message.byteLength)
    : new Uint8Array(message);
  const frames: Array<{ type: string; value: string }> = [];
  let offset = 0;
  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 8) throw new Error("RTC TLV header is incomplete");
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4);
    const length = view.getUint32(0, false);
    const valueStart = offset + 8;
    const valueEnd = valueStart + length;
    if (valueEnd > bytes.byteLength) throw new Error("RTC TLV payload is incomplete");
    frames.push({ type, value: new TextDecoder().decode(bytes.subarray(valueStart, valueEnd)) });
    offset = valueEnd;
  }
  return frames;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stableTurnId(data: Record<string, unknown>, role: TranscriptTurn["role"], text: string): string {
  const providerId = data.id || data.utteranceId || data.paragraphId || data.sequence;
  if (providerId !== undefined && providerId !== null && String(providerId)) return `rtc-${String(providerId)}`;
  return `rtc-${stableHash(JSON.stringify([
    role,
    text,
    data.startTime ?? data.start_time ?? null,
    data.endTime ?? data.end_time ?? null,
  ]))}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class RtcVoiceClient {
  private engine: any;
  private vertc: any;
  private reconnectTimer: number | undefined;
  private lastFinalTurnAt = 0;
  private seenTurnIds = new Set<string>();

  async connect(
    session: VoiceSession,
    onTurn: (turn: TranscriptTurn) => void,
    onStatus: (status: string, state?: RtcConnectionState) => void,
    onFatal?: (message: string) => void,
  ): Promise<void> {
    if (!session.rtc) throw new Error("缺少 RTC 入房参数");
    onStatus("正在检查实时语音能力", "checking");
    const module = await import("@volcengine/rtc");
    const VERTC = module.default;
    this.vertc = VERTC;
    if (!(await withTimeout(VERTC.isSupported(), RTC_PERMISSION_TIMEOUT_MS, "检查 RTC 能力超时"))) throw new Error("当前浏览器不支持火山 RTC");
    const permission = await withTimeout(
      VERTC.enableDevices({ video: false, audio: true }),
      RTC_PERMISSION_TIMEOUT_MS,
      "麦克风授权超时",
    );
    if (!permission.audio) throw new Error("没有麦克风权限");
    this.engine = VERTC.createEngine(session.rtc.appId);
    const clearReconnectTimer = () => {
      if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    };
    const startReconnectTimer = () => {
      clearReconnectTimer();
      this.reconnectTimer = window.setTimeout(() => {
        onStatus("语音连接恢复超时", "lost");
        onFatal?.("语音连接中断，可以重新连接或结束本次陪伴。");
      }, RTC_RECONNECT_TIMEOUT_MS);
    };
    this.engine.on(VERTC.events.onConnectionStateChanged, (event: { state: number }) => {
      const states: Record<number, [string, RtcConnectionState]> = {
        [module.ConnectionState.CONNECTION_STATE_CONNECTING]: ["正在连接语音房间", "joining"],
        [module.ConnectionState.CONNECTION_STATE_CONNECTED]: ["实时语音已连接", "connected"],
        [module.ConnectionState.CONNECTION_STATE_RECONNECTING]: ["网络波动，正在重连", "reconnecting"],
        [module.ConnectionState.CONNECTION_STATE_RECONNECTED]: ["已重新连接", "connected"],
        [module.ConnectionState.CONNECTION_STATE_LOST]: ["语音连接中断", "lost"],
        [module.ConnectionState.CONNECTION_STATE_DISCONNECTED]: ["语音已断开", "closed"],
      };
      const next = states[event.state];
      if (!next) return;
      onStatus(next[0], next[1]);
      if (next[1] === "reconnecting" || next[1] === "lost") startReconnectTimer();
      if (next[1] === "connected" || next[1] === "closed") clearReconnectTimer();
    });
    this.engine.on(VERTC.events.onError, () => {
      onStatus("实时语音发生错误", "error");
      onFatal?.("实时语音发生错误，可以重新连接或结束本次陪伴。");
    });
    this.engine.on(VERTC.events.onRoomBinaryMessageReceived, (event: { message: BinaryMessage }) => {
      try {
        for (const parsed of parseTlvFrames(event.message)) {
          if (parsed.type === "subv") {
            const payload = JSON.parse(parsed.value);
            for (const raw of payload.data || []) {
              const data = raw as Record<string, unknown>;
              const text = typeof data.text === "string" ? data.text.trim() : "";
              if (!text || !(data.paragraph || data.definite)) continue;
              const role: TranscriptTurn["role"] = data.userId === session.rtc?.userId ? "user" : "assistant";
              const clientTurnId = stableTurnId(data, role, text);
              if (this.seenTurnIds.has(clientTurnId)) continue;
              this.seenTurnIds.add(clientTurnId);
              this.lastFinalTurnAt = Date.now();
              onTurn({ clientTurnId, role, text });
            }
          } else if (parsed.type === "conv") {
            const code = JSON.parse(parsed.value)?.Stage?.Code;
            if (code === 1) onStatus("正在听你说", "listening");
            else if (code === 2) onStatus("AI 正在思考", "thinking");
            else if (code === 3) onStatus("AI 正在说话", "speaking");
            else onStatus("实时语音已连接", "connected");
          }
        }
      } catch {
        // Provider frames are untrusted operational input; ignore malformed content without logging user text.
      }
    });
    try {
      onStatus("正在进入语音房间", "joining");
      await withTimeout(
        this.engine.joinRoom(
          session.rtc.token,
          session.rtc.roomId,
          { userId: session.rtc.userId, extraInfo: JSON.stringify({ call_scene: "RTC-AIGC", user_name: session.rtc.userId }) },
          { isAutoPublish: true, isAutoSubscribeAudio: true, roomProfileType: module.RoomProfileType.chat },
        ),
        RTC_CONNECTION_TIMEOUT_MS,
        "进入 RTC 房间超时",
      );
      await withTimeout(this.engine.startAudioCapture(), RTC_CONNECTION_TIMEOUT_MS, "启动麦克风超时");
      onStatus("正在聆听，直接说话", "listening");
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async stopCaptureAndDrain(): Promise<void> {
    if (!this.engine) return;
    try { await this.engine.stopAudioCapture(); } catch {}
    const startedAt = Date.now();
    let observedFinalTurnAt = this.lastFinalTurnAt;
    let quietStartedAt = startedAt;
    while (Date.now() - startedAt < FINAL_TURN_MAX_WAIT_MS) {
      if (this.lastFinalTurnAt > observedFinalTurnAt) {
        observedFinalTurnAt = this.lastFinalTurnAt;
        quietStartedAt = Date.now();
      }
      if (Date.now() - quietStartedAt >= FINAL_TURN_QUIET_MS) break;
      await delay(100);
    }
    await this.leaveAndDestroy();
  }

  async disconnect(): Promise<void> {
    if (!this.engine) return;
    try { await this.engine.stopAudioCapture(); } catch {}
    await this.leaveAndDestroy();
  }

  private async leaveAndDestroy(): Promise<void> {
    if (!this.engine) return;
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    try { await this.engine.leaveRoom(); } catch {}
    this.vertc?.destroyEngine(this.engine);
    this.engine = undefined;
  }
}
