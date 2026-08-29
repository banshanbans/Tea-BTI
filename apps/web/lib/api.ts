import { ApiClient } from "@tea-bti/contracts";
import type { components } from "@tea-bti/contracts";

export type Schemas = components["schemas"];
export type AnonymousSession = Schemas["AnonymousSessionResponse"];
export type Bootstrap = Schemas["BootstrapResponse"];
export type SeedBatch = Schemas["SeedBatchResponse"];
export type BlindCard = Schemas["BlindCardResponse"];
export type SwipeResult = Schemas["SwipeResponse"];
export type TeaSummary = Schemas["TeaSummaryResponse"];
export type TeaDetail = Schemas["TeaDetailResponse"];
export type TeaJourney = Schemas["TeaJourneyResponse"];
export type Recommendation = Schemas["RecommendationResponse"];
export type Passport = Schemas["PassportResponse"];
export type TeaBti = Schemas["TeaBtiResponse"];
export type VoiceSession = Schemas["VoiceSessionResponse"];
export type VoiceStop = Schemas["VoiceStopResponse"];
export type TasteResult = Schemas["TasteNormalizeResponse"];
export type RealmList = Schemas["RealmListResponse"];
export type RealmDetail = Schemas["RealmDetailResponse"];
export type RealmMutation = Schemas["RealmMutationResponse"];
export type RealmComplete = Schemas["RealmCompleteResponse"];
export type RealmProgress = Schemas["RealmProgressResponse"];
export type RealmAsset = Schemas["RealmAssetResponse"];
export type TeaProfile = Schemas["TeaProfileResponse"];
export type TeaProfileMutation = Schemas["TeaProfileMutationResponse"];
export type ProfileShareMutation = Schemas["ProfileShareMutationResponse"];
export type PublicTeaProfile = Schemas["PublicTeaProfileResponse"];
export type ProfileBlockId = Schemas["ProfileBlockId"];

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const TOKEN_KEY = "tea-bti.anonymousToken";
const LEGACY_TOKEN_KEY = "shuacha.anonymousToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(TOKEN_KEY);
  if (current) return current;
  const legacy = window.localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) window.localStorage.setItem(TOKEN_KEY, legacy);
  return legacy;
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
}

export const apiClient = new ApiClient({ baseUrl: API_URL, getToken });
const publicApiClient = new ApiClient({ baseUrl: API_URL });

export async function ensureSession(): Promise<string> {
  const current = getToken();
  if (current) return current;
  const session = await apiClient.request<AnonymousSession>("/sessions/anonymous", { method: "POST" });
  window.localStorage.setItem(TOKEN_KEY, session.accessToken);
  return session.accessToken;
}

export async function authenticated<T>(path: string, init: RequestInit = {}): Promise<T> {
  await ensureSession();
  try {
    return await apiClient.request<T>(path, init);
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      clearToken();
      await ensureSession();
      return apiClient.request<T>(path, init);
    }
    throw error;
  }
}

export function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return publicApiClient.request<T>(path, init);
}

export function jsonBody(value: unknown): Pick<RequestInit, "body" | "headers"> {
  return { body: JSON.stringify(value), headers: { "Content-Type": "application/json" } };
}

export function mediaUrl(path: string): string {
  return new URL(path, new URL(API_URL).origin).toString();
}
