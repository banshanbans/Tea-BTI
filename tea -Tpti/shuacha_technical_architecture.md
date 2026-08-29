# 《刷茶》技术架构与技术栈

> 目标：在 48 小时 Hackathon 内做出可真实体验的端到端 Demo。  
> 原则：**少训练、重交互、可解释、可降级、不要伪精确。**

---

# 1. 总体架构

```text
Mobile Web / PWA
    │
    ├── Blind Swipe Feed
    ├── Tea Detail
    ├── Brew Mode
    ├── Taste Mode
    ├── Tea Realm
    ├── Tea Passport
    └── Tea-BTI
    │
    ▼
API Gateway / Backend
    │
    ├── Recommendation Service
    ├── Tea Profile Service
    ├── Multimodal Brew Companion
    ├── Tasting Conversation Service
    ├── Tea-BTI Service
    ├── Memory / Passport Service
    └── Analytics Event Service
    │
    ├── PostgreSQL / Supabase
    ├── pgvector
    ├── Object Storage
    └── LLM / VLM / Realtime Model Provider
```

---

# 2. 推荐技术栈

## Frontend

### 核心

- **Next.js 15**
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Framer Motion**

### 原因

- 快速搭建移动端 Web；
- 容易部署；
- 组件生态成熟；
- Framer Motion 很适合 Swipe / Reveal / 页面转场；
- Stitch 生成的前端可以较容易迁移成 React / Tailwind 页面。

### 状态管理

轻量方案优先：

- Zustand

管理：

- 当前 Swipe Queue；
- 本地 Taste Vector；
- 当前茶；
- Tea Passport；
- Tea-BTI；
- AI Companion Session。

48 小时不需要 Redux。

---

# 3. 2.5D 茶境

## 推荐

- **Phaser 3**

用途：

- 2.5D / 像素茶园；
- 点击 / 拖动；
- 轻动画；
- Scene 状态；
- 简单任务进度。

### 为什么不用重型 3D

不建议：

- Unity WebGL；
- Three.js 大型场景；
- Unreal；
- 完整经营模拟。

Demo 只做：

> 一款茶、一个短章节、3–4 个核心动作。

Phaser 3 足够。

### 资源

- 像素 / 2.5D 茶山背景；
- 茶树；
- 嫩芽；
- 制茶锅；
- 茶农角色；
- 茶叶 Sprite；
- 杯子。

优先使用预制资源 + 少量帧动画。

---

# 4. Backend

## 推荐

- **FastAPI**
- **Python 3.12**
- **Pydantic**
- **SQLAlchemy / SQLModel**

原因：

- AI / Embedding / VLM 生态好；
- 开发速度快；
- SSE / WebSocket 易实现；
- 推荐逻辑可直接使用 NumPy。

---

# 5. 数据层

## 推荐

### Supabase

使用：

- PostgreSQL；
- Auth（如果后续需要）；
- Storage；
- Realtime（可选）；
- pgvector。

### Hackathon 版本

不强制注册。

生成：

```text
anonymous_user_id
```

存储匿名偏好即可。

---

# 6. 核心数据模型

## Tea

```ts
Tea {
  id: string
  name: string
  region: string
  tea_type: string

  official_aroma: string[]
  official_taste: string[]
  process: string[]

  sensory_vector: number[]
  embedding: number[]

  blind_copy: {
    headline: string
    description: string
    scene: string
    tags: string[]
  }

  brewing_guide: {
    vessel: string
    temperature_range?: string
    steep_time?: string
    notes: string[]
  }

  story_scene_id?: string
}
```

---

## UserTasteProfile

```ts
UserTasteProfile {
  user_id: string

  freshness: number
  sweetness: number
  body: number
  roast: number
  astringency: number
  floral: number
  fruity: number
  clean: number
  aftertaste: number

  embedding: number[]

  sample_count: number
  confidence_state: "forming" | "early" | "stable"
}
```

---

## SwipeEvent

```ts
SwipeEvent {
  user_id: string
  tea_id: string
  action: "like" | "skip" | "save"
  timestamp: string
}
```

---

## DrinkFeedback

```ts
DrinkFeedback {
  user_id: string
  tea_id: string

  result: "like" | "neutral" | "dislike"

  user_words?: string
  normalized_tags?: string[]

  infusion_number?: number

  timestamp: string
}
```

---

## TeaPassportEntry

```ts
TeaPassportEntry {
  user_id: string
  tea_id: string

  first_drunk_at: string

  favorite_infusion?: number
  user_description?: string
  normalized_tags?: string[]

  brewed: boolean
  tasted: boolean
  realm_unlocked: boolean
}
```

---

# 7. Tea Profile 数据结构

每款茶不能只存一段介绍文字。

必须建立结构化 Profile。

建议字段：

```text
专业感官：
- aroma
- taste
- body
- sweetness
- freshness
- astringency
- aftertaste

客观资料：
- region
- tea_type
- cultivar
- process
- harvest
- official_description

年轻化表达：
- blind_headline
- blind_description
- scene
- emotion
- visual_metaphor
```

### 数据原则

客观信息：

> 来自可靠 / 官方资料。

LLM：

> 只负责翻译表达，不负责创造事实。

---

# 8. 推荐系统

## 8.1 Demo 不训练专用模型

12–20 款茶即可建立 Tea Profile。

每款茶：

```text
Tea Sensory Vector
+
Text Embedding
```

---

## 8.2 初始 Feed

Cold Start：

- 多样性优先；
- 选择感官差异大的茶；
- 不需要随机完全打乱；
- 让前 5 张覆盖不同 taste region。

目的：

> 快速探测用户边界。

---

## 8.3 Taste Vector 更新

最简单：

```text
User Vector
=
Σ(like tea vectors × weight)
-
Σ(skip tea vectors × weight)
+
Σ(drink feedback × larger weight)
```

示例权重：

```text
skip       -0.5
like       +1
save       +1.5
drink_like +3
drink_dislike -3
```

真喝反馈权重大于 Swipe。

---

## 8.4 Embedding 推荐

每款茶同时生成 Embedding。

用户 Embedding：

```text
mean(liked embeddings)
-
mean(disliked embeddings)
```

然后：

```text
cosine_similarity(user_embedding, tea_embedding)
```

得到候选。

---

## 8.5 最终排序

建议：

```text
score =
0.55 * sensory_similarity
+
0.30 * embedding_similarity
+
0.15 * exploration_bonus
```

前期：

提高 exploration_bonus。

后期：

增加 taste match。

---

# 9. Blind Card 文案生成

## 输入

```json
{
  "name": "某款茶",
  "official_aroma": [],
  "official_taste": [],
  "process": [],
  "region": ""
}
```

## LLM 输出

```json
{
  "headline": "",
  "description": "",
  "scene": "",
  "tags": []
}
```

约束：

- 不出现茶名；
- 不出现品牌；
- 不出现茶类；
- 不编造感官特征；
- 语言不使用过度玄学；
- 文案长度适合单屏卡片；
- 所有描述必须可追溯到输入特征。

Demo 可提前离线生成，避免现场延迟。

---

# 10. “我开始有点懂你了”生成逻辑

不要让 LLM 自由总结全部历史。

先用程序计算：

```text
top_positive_dimensions
top_negative_dimensions
top_liked_teas
top_skipped_teas
```

再交给 LLM 转成自然语言。

例如：

```json
{
  "positive": ["fresh", "light", "sweet"],
  "negative": ["heavy", "roasted"],
  "recommendation": "tea_003"
}
```

LLM 仅负责表达。

这样更稳定。

---

# 11. AI Brew Companion

## 11.1 目标

实现：

> 摄像头看 + AI 实时说。

不追求高精度视觉检测。

---

## 11.2 Demo 架构

```text
Browser Camera
    │
    ├── local preview
    │
    └── sampled frames (0.5–1 FPS)
            │
            ▼
        FastAPI
            │
            ▼
      Multimodal VLM
            │
            ▼
      Brew State JSON
            │
            ▼
       Companion Logic
            │
            ▼
        Voice / Text
```

---

## 11.3 为什么使用帧采样

48 小时阶段不需要持续传完整视频。

每 1–2 秒抽一帧即可识别粗状态：

```text
EMPTY
TEA_VISIBLE
POURING
STEEPING
DECANTING
FINISHED
```

同时保持延迟可控。

---

## 11.4 VLM 输出必须结构化

示例：

```json
{
  "state": "POURING",
  "confidence": 0.83,
  "observations": [
    "water is being poured into a gaiwan"
  ],
  "uncertain": [
    "exact water temperature"
  ]
}
```

然后由规则 + LLM 生成陪伴话术。

---

## 11.5 不允许模型声称

- “现在是 87.3°C”；
- “你放了 4.8g 茶”；
- “茶多酚浓度过高”。

除非有额外传感器。

---

# 12. 语音

推荐两种方案。

## 方案 A：Realtime Multimodal API

适合：

- 低延迟；
- 语音输入；
- TTS 输出；
- Conversation Memory。

使用 provider adapter：

```text
RealtimeProvider
```

不要把架构写死在单一供应商。

---

## 方案 B：ASR + LLM + TTS

如果 Realtime API 不稳定：

```text
Speech to Text
→
LLM
→
Text to Speech
```

作为降级方案。

---

# 13. Taste Mode

输入：

- 用户语音 / 文本；
- 当前茶 Tea Profile；
- 当前第几泡；
- 历史用户 Taste Profile。

流程：

```text
User words
    │
    ▼
LLM semantic normalization
    │
    ├── keep original wording
    └── map to tea descriptors
            │
            ▼
DrinkFeedback
            │
            ▼
Taste Vector Update
```

---

## LLM 输出

```json
{
  "user_words": "像青草，但喝完有点甜",
  "normalized": [
    "fresh",
    "tender_aroma",
    "aftertaste_sweetness"
  ],
  "explanation": "..."
}
```

### 原则

AI 不应该告诉用户：

> “你喝错了。”

而应该：

> “你刚刚说的感觉，在茶里通常会这样描述。”

---

# 14. Tea-BTI

## 底层不是 LLM 人格测试

底层从 Taste Vector 投影到四个轴。

示例：

```text
Axis 1
Light ←→ Full

Axis 2
Fresh ←→ Warm

Axis 3
Soft/Sweet ←→ Punchy

Axis 4
Clean ←→ Long
```

每轴：

```text
0–100
```

例如：

```json
{
  "light_full": 24,
  "fresh_warm": 18,
  "sweet_punchy": 32,
  "clean_long": 71
}
```

---

## Tea-BTI 名称生成

不要让模型每次随机命名。

Demo 建议预先设计 6–8 个 Archetype。

规则匹配：

```text
if light < 35
and fresh < 35
and long > 65
→ SPRING_MIST
```

显示：

> 春雾回甘型

LLM 只负责解释。

---

## 稳定度

```text
0–5 signals
→ 正在形成

6–15
→ 初见

16+
→ 逐渐稳定
```

真喝反馈可计更高信号权重。

---

# 15. Tea Passport / Memory

核心存储：

```text
tea
user original words
normalized taste tags
favorite infusion
brew completion
taste completion
realm completion
```

AI Companion 以后回答：

> “你上次喝这款的时候觉得什么？”

直接查询 Passport，而不是让模型凭记忆猜。

---

# 16. Taste Graph

Demo 数据图：

```text
User ─LIKES→ Tea
User ─DRANK→ Tea
User ─DESCRIBED_AS→ SensoryTag
Tea ─HAS_ATTRIBUTE→ SensoryTag
Tea ─FROM→ Region
```

生产环境不一定需要图数据库。

Hackathon：

> PostgreSQL 足够。

可以通过 SQL 聚合得到：

```text
tea A co-liked with tea B
```

---

# 17. AI Context / Memory

每次 AI Companion Session 输入：

```text
current_tea
current_mode
tea_profile
brew_guide
user_taste_profile
passport_history
recent_messages
```

不要把整个历史聊天全部发送。

采用摘要：

```text
conversation_summary
```

---

# 18. Analytics Event

每个关键动作埋点。

```text
session_started
blind_card_seen
tea_liked
tea_skipped
tea_revealed
recommendation_shown
drink_started
drink_feedback
brew_mode_started
brew_step_detected
taste_mode_started
taste_phrase_saved
realm_started
realm_completed
passport_added
teabti_updated
```

长期可以构建 Taste Graph。

---

# 19. API 草案

## Feed

```http
GET /api/feed
```

---

## Swipe

```http
POST /api/swipe

{
  "tea_id": "...",
  "action": "like"
}
```

返回：

```json
{
  "taste_profile_delta": {},
  "next_tea": {},
  "recommendation_ready": false
}
```

---

## Recommendation

```http
GET /api/recommendation
```

---

## Drink Feedback

```http
POST /api/drink-feedback
```

---

## Taste Normalize

```http
POST /api/taste/normalize
```

---

## Brew Analyze Frame

```http
POST /api/brew/frame
```

返回：

```json
{
  "state": "POURING",
  "message": "..."
}
```

---

## Passport

```http
GET /api/passport
POST /api/passport
```

---

## Tea-BTI

```http
GET /api/teabti
```

---

# 20. 实时通信

## Brew Mode

Demo：

- WebSocket 或 SSE；
- 前端定时发送帧；
- 服务端返回状态和消息。

如果使用双向语音：

- WebRTC / provider Realtime channel。

---

# 21. 缓存

48 小时不需要复杂 Redis。

可缓存：

- Tea Profile；
- Blind Card；
- Tea Embedding；
- Tea Realm static data。

如果已有 Redis 环境再使用。

---

# 22. 部署

## Frontend

- Vercel / Cloudflare Pages / 静态托管

## Backend

- Railway / Render / Fly.io / 腾讯云 / 阿里云 / 火山云

Hackathon 中国现场建议：

> 选已经测试过、网络最稳定的云。

## Database

- Supabase / Neon / 自建 PostgreSQL

---

# 23. Demo Offline / Fallback 机制

非常重要。

现场必须允许降级。

## Swipe

完全本地 Mock 也能运行。

## Recommendation

本地 Taste Vector 算法即可，不依赖 LLM。

## Blind Copy

提前生成。

## Tea-BTI

本地规则计算。

## Tea Realm

完全前端运行。

只有：

- Brew Vision；
- Taste Conversation；
- Voice

需要外部模型。

如果模型失败：

> 展示预设 Demo fallback。

不要让网络把整条 Journey 打断。

---

# 24. 48 小时开发优先级

## P0

- Swipe；
- Reveal；
- Taste Vector；
- Recommendation；
- Tea Detail；
- Passport；
- Tea-BTI；
- Tea Realm 核心 Scene。

## P1

- Taste AI；
- Voice；
- Brew camera；
- 视觉状态识别。

## P2

- 完整聊天历史；
- 多 Tea Realm；
- B 端 Taste Graph Dashboard；
- 登录系统；
- 商城。

---

# 25. 推荐 Repo 结构

```text
shuacha/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── swipe/
│   │   │   ├── tea-detail/
│   │   │   ├── brew/
│   │   │   ├── taste/
│   │   │   ├── tea-realm/
│   │   │   ├── passport/
│   │   │   └── teabti/
│   │   └── stores/
│   │
│   └── api/
│       ├── main.py
│       ├── routes/
│       ├── services/
│       │   ├── recommendation.py
│       │   ├── brew_vision.py
│       │   ├── tasting.py
│       │   ├── teabti.py
│       │   └── memory.py
│       └── models/
│
├── packages/
│   └── shared-schema/
│
├── assets/
│   └── tea-realm/
│
└── docs/
```

---

# 26. 技术叙事（答辩版）

不要说：

> “我们用了很多 AI。”

推荐说：

> **《刷茶》的 AI 分成三层。**
>
> 第一层是 Taste Vector：用户不填问卷，Swipe 和真喝反馈直接更新偏好。
>
> 第二层是 Multimodal Companion：当用户真正泡茶、品茶时，视觉和语音模型才出现，帮助用户完成第一次真实饮茶。
>
> 第三层是 Memory：喝过的茶进入 Tea Passport，并进一步形成 Tea-BTI 和 Taste Graph，让下一杯越来越准。
>
> **AI 不站在用户面前，而是藏在“刷、泡、品、记住”的每一个关键动作后面。**
