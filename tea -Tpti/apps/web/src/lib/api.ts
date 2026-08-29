// ============================================================
// 后端 API Client —— 封装 FastAPI 的 8 个业务端点 + /health
// 数据契约对齐 apps/api/schemas.py。所有请求带超时与错误兜底，
// 失败时抛错，由调用方（store/hook）决定是否降级到本地 mock。
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** 匿名用户 id（demo 单用户；真实产品可替换为登录态） */
export const ANON_USER_ID = 'demo-user';

const REQUEST_TIMEOUT_MS = 4000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`API ${path} -> ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 类型（对齐 schemas.py）
// ---------------------------------------------------------------------------

export interface BackendTea {
  id: string;
  name: string;
  region: string;
  tea_type: string;
  emoji?: string;
  official_aroma: string[];
  official_taste: string[];
  process: string[];
  sensory_vector: number[];
  blind_copy: {
    headline: string;
    description: string;
    scene: string;
    tags: string[];
  };
  brewing_guide: {
    vessel: string;
    temperature_range?: string;
    steep_time?: string;
    notes: string[];
  };
}

export interface FeedResponse {
  mode: string;
  confidence_state: string;
  teas: BackendTea[];
}

export interface SwipeResponse {
  taste_profile_delta: Record<string, number>;
  next_tea: BackendTea | null;
  recommendation_ready: boolean;
}

export interface RecommendationResponse {
  user_id: string;
  teas: BackendTea[];
  confidence_state: string;
  exploration_bonus: number;
}

export interface TasteNormalizeResponse {
  user_words: string;
  normalized: string[];
  explanation: string;
}

export interface BrewFrameResponse {
  state: string;
  confidence: number;
  message: string;
  observations: string[];
  uncertain: string[];
  suggestion: string;
}

export interface PassportEntry {
  user_id: string;
  tea_id: string;
  first_drunk_at: string;
  favorite_infusion?: number;
  user_description?: string;
  normalized_tags?: string[];
  brewed: boolean;
  tasted: boolean;
  realm_unlocked: boolean;
  tea?: BackendTea;
}

export interface TeaBtiResponse {
  user_id: string;
  axes: {
    light_full: number;
    fresh_warm: number;
    sweet_punchy: number;
    clean_long: number;
  };
  archetype: string;
  archetype_name: string;
  confidence_state: string;
  confidence_label: string;
  explanation: string;
  evidence: Array<{
    tea_id: string;
    tea_name: string;
    emoji: string;
    action: string;
    headline: string;
    tags: string[];
    similarity: number;
  }>;
}

// ---------------------------------------------------------------------------
// 端点
// ---------------------------------------------------------------------------

export function isBackendHealthy(): Promise<boolean> {
  return request<{ status: string }>('/health')
    .then((r) => r.status === 'ok')
    .catch(() => false);
}

export function fetchFeed(userId: string = ANON_USER_ID): Promise<FeedResponse> {
  return request<FeedResponse>(`/api/feed?user_id=${encodeURIComponent(userId)}`);
}

export function postSwipe(
  teaId: string,
  action: 'like' | 'skip' | 'save',
  userId: string = ANON_USER_ID,
): Promise<SwipeResponse> {
  return request<SwipeResponse>('/api/swipe', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, tea_id: teaId, action }),
  });
}

export function fetchRecommendation(userId: string = ANON_USER_ID): Promise<RecommendationResponse> {
  return request<RecommendationResponse>(`/api/recommendation?user_id=${encodeURIComponent(userId)}`);
}

export function fetchTeaBti(userId: string = ANON_USER_ID): Promise<TeaBtiResponse> {
  return request<TeaBtiResponse>(`/api/teabti?user_id=${encodeURIComponent(userId)}`);
}

export function fetchPassport(userId: string = ANON_USER_ID): Promise<PassportEntry[]> {
  return request<PassportEntry[]>(`/api/passport?user_id=${encodeURIComponent(userId)}`);
}

export function postTasteNormalize(userWords: string): Promise<TasteNormalizeResponse> {
  return request<TasteNormalizeResponse>('/api/taste/normalize', {
    method: 'POST',
    body: JSON.stringify({ user_words: userWords }),
  });
}

export function postBrewFrame(stepHint: string): Promise<BrewFrameResponse> {
  return request<BrewFrameResponse>('/api/brew/frame', {
    method: 'POST',
    body: JSON.stringify({ step_hint: stepHint }),
  });
}

export function postDrinkFeedback(
  teaId: string,
  result: 'like' | 'neutral' | 'dislike',
  userWords?: string,
  userId: string = ANON_USER_ID,
): Promise<unknown> {
  return request('/api/drink-feedback', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, tea_id: teaId, result, user_words: userWords }),
  });
}
