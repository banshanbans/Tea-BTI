import type { VoiceSession } from "./api";

export type TranscriptTurn = { clientTurnId: string; role: "user" | "assistant"; text: string };

function parseTlv(buffer: ArrayBuffer): { type: string; value: string } {
  const typeBytes = new Uint8Array(buffer, 0, 4);
  const lengthBytes = new Uint8Array(buffer, 4, 4);
  const type = Array.from(typeBytes).map((value) => String.fromCharCode(value)).join("");
  const length = (lengthBytes[0] << 24) | (lengthBytes[1] << 16) | (lengthBytes[2] << 8) | lengthBytes[3];
  return { type, value: new TextDecoder().decode(new Uint8Array(buffer, 8, length)) };
}

export class RtcVoiceClient {
  private engine: any;

  async connect(session: VoiceSession, onTurn: (turn: TranscriptTurn) => void, onStatus: (status: string) => void): Promise<void> {
    if (!session.rtc) throw new Error("缺少 RTC 入房参数");
    const module = await import("@volcengine/rtc");
    const VERTC = module.default;
    if (!(await VERTC.isSupported())) throw new Error("当前浏览器不支持火山 RTC");
    const permission = await VERTC.enableDevices({ video: false, audio: true });
    if (!permission.audio) throw new Error("没有麦克风权限");
    this.engine = VERTC.createEngine(session.rtc.appId);
    this.engine.on(VERTC.events.onRoomBinaryMessageReceived, (event: { message: ArrayBuffer }) => {
      try {
        const parsed = parseTlv(event.message);
        if (parsed.type === "subv") {
          const payload = JSON.parse(parsed.value);
          const data = payload.data?.[0];
          if (data?.text && (data.paragraph || data.definite)) {
            onTurn({
              clientTurnId: crypto.randomUUID(),
              role: data.userId === session.rtc?.userId ? "user" : "assistant",
              text: data.text,
            });
          }
        } else if (parsed.type === "conv") {
          const code = JSON.parse(parsed.value)?.Stage?.Code;
          onStatus(code === 2 ? "AI 正在思考" : code === 3 ? "AI 正在说话" : code === 1 ? "正在听你说" : "已连接");
        }
      } catch { /* Ignore provider messages outside the documented TLV types. */ }
    });
    await this.engine.joinRoom(
      session.rtc.token,
      session.rtc.roomId,
      { userId: session.rtc.userId, extraInfo: JSON.stringify({ call_scene: "RTC-AIGC", user_name: session.rtc.userId }) },
      { isAutoPublish: true, isAutoSubscribeAudio: true, roomProfileType: module.RoomProfileType.chat },
    );
    await this.engine.startAudioCapture();
    onStatus("已进入语音房间");
  }

  async disconnect(): Promise<void> {
    if (!this.engine) return;
    try { await this.engine.stopAudioCapture(); } catch {}
    try { await this.engine.leaveRoom(); } catch {}
    const module = await import("@volcengine/rtc");
    module.default.destroyEngine(this.engine);
    this.engine = undefined;
  }
}

