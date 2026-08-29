# Tea-BTI 技术架构与技术栈

> 目标：在 48 小时 Hackathon 内做出可真实体验的端到端 Demo。  
> 原则：**少训练、重交互、可解释、可降级、不要伪精确。**

---

# 1. 总体架构

```text
Mobile Web / PWA
    │
    ├── Identified Eight-Tea Swipe Feed
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
- Swipe 动效和页面内交互；
- 当前茶的临时 UI 状态；
- AI Companion 的字幕、连接与麦克风状态。

Taste Vector、Tea Journey、Passport、Realm Progress 与 Tea-BTI 以服务端状态为准，Zustand 不作为其持久化来源。

48 小时不需要 Redux。

## User Journey Orchestration

破冰和应用主界面使用不同 Shell：`mbti / seeds` 不渲染顶部应用栏和底部 Tab，`feed / reveal / recommendation` 才进入应用导航。新用户、未完成破冰的用户和 `fromProfile` 访问者在 Bootstrap 后直接进入 MBTI；已完成破冰的回访用户经过至少 `0.8s` 品牌过渡后恢复 Feed。`tea-bti.launchSeen` 仅为旧版本兼容保留，不再参与入口判断；恢复依据始终来自 `/bootstrap.onboardingCompleted`。

MBTI 转盘状态只保存在前端：16 型采用固定顺序、CSS Scroll Snap 和 Pointer/Keyboard 输入，确认后仍调用既有 `POST /onboarding/seed`。未知类型提交 `mbti: null`，不产生新的领域状态。

Swipe 由单一 MotionValue 驱动顶层位移、旋转、X / Heart 强度以及第二、第三张卡的上移补位。手势和按钮进入同一个幂等提交函数；飞卡动画与 API 并行，接口失败时恢复原卡并允许重试。`prefers-reduced-motion` 下取消旋转、弹性和脉冲，只保留短淡入淡出与即时补位。

单茶页的主操作不在前端拼接 Passport 和 Realm 状态。后端通过 `TeaJourneyResponse` 聚合 `PassportEntry + RealmProgress`，按 `brew → taste → realm → passport` 返回第一个未完成阶段。该结果只用于引导，不作为路由权限或解锁门槛。

内部导航只接受固定来源：`origin = swipe | passport | profile`，未知值回退为 `swipe`；Tea Realm 另接受 `entry = tea | realm`，未知值回退为 `realm`。茶详情、Brew、Taste 与从茶详情进入的 Realm 透传 `origin`，Realm 仅在 `entry = tea` 且 Tea ID 与已加载定义一致时退出到茶详情，否则安全回到 `/realm`。不接收通用 `returnTo` 或外部 URL。

Swipe 的下一张 `cardId` 只保存在当前前端 Zustand 内存中，用于客户端路由往返后的 Feed 恢复；整页刷新不持久化该位置。Tea Realm 的界面幕与服务端 `currentScene` 分开：返回已完成幕只修改本地 `screen`，再次向前若该幕已在 `completedScenes` 中则不调用 `PATCH /progress`，只有服务端前沿幕可以提交新的完成事件。

---

# 3. Tea Realm《雾里一芽》

首版不引入 Canvas、Three.js、Phaser 或游戏引擎。七幕交互使用与业务页相同的技术边界：

- React 19 组件与显式状态机；
- Pointer Events 和键盘事件；
- SVG / CSS 轮廓与层次；
- Framer Motion 进入、Reveal 与标本收集过渡。

## 七幕状态机

```text
liquor-entry
  → mist-mountain
  → pick-bud
  → wok-craft
  → human-judgment
  → real-tea-reveal
  → passport-specimen
```

每幕完成都先写入后端，服务端确认后才前进。刷新时从 `currentScene` 恢复；网络失败保留当前交互状态。已完成用户重玩只增加 `replayCount`，不改写首次完成时间。

## 设备能力降级

```text
prefers-reduced-motion
  → reducedMotion
else 用户点击“进入茶境”后请求方向权限
  → orientation（已授权）
  → pointer（拒绝 / 不支持 / 桌面端 / 异常）
```

茶境不请求摄像头或麦克风，不声称识别现实中的芽叶、锅温或手势。

## 资产分层

- 雾层、风格化山体、工坊和数字标本是 `synthetic_demo`，只承担氛围；
- 真实干茶 Reveal 是 `documentary + open_license`，承担实物锚点；
- Manifest v2 记录资产角色、来源、真实性、权利、证据、尺寸、路径和 SHA-256；
- `53,000+` 保持 `evidenceStatus: debt`，是公开发布阻断项。

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

  feed_copy: {
    headline: string
    description: string
    scene: string
    tags: string[]
  }

  visual_profile: VisualProfile

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
  realm_unlocked: boolean // 只由 Tea Realm 完成事务写入
  realm_completed_at?: string
  specimens: RealmSpecimen[]
}
```

---

## RealmProgress / RealmSpecimen

```ts
RealmProgress {
  user_id: string
  realm_id: string
  tea_id: string
  current_scene: string
  completed_scenes: string[]
  interaction_mode?: "orientation" | "pointer" | "reducedMotion"
  total_elapsed_ms: number
  replay_count: number
  used_taste_words: boolean
  started_at: string
  updated_at: string
  completed_at?: string
}

RealmSpecimen {
  user_id: string
  realm_id: string
  tea_id: string
  specimen_id: string
  collected_at: string
}
```

`RealmProgress(user_id, realm_id)` 和 `RealmSpecimen(user_id, realm_id, specimen_id)` 都有唯一约束。最终完成在同一事务中更新 Progress、Specimen、Passport `realm_unlocked` 和黔南点亮状态。该事务不访问 Taste Vector 或 Tea-BTI 轴。

## User Tea Profile / ProfileShare

```ts
TeaProfile {
  user_id: string                 // 一对一、私有主键
  display_name: string            // 2–24，默认“一位喝茶的人”
  bio: string                     // 最多 80 字
  selected_tea_id?: string        // 只能引用真实行为候选
  source_feedback_id?: string     // 必须属于当前用户且有确认原话
  public_quote?: string           // 最多 120 字，不改写原反馈
  public_block_ids: ProfileBlockId[]
  created_at: string
  updated_at: string
}

ProfileShare {
  user_id: string                 // 每用户唯一
  public_id?: string              // 至少 128-bit 随机 capability
  created_at?: string
  revoked_at?: string
  updated_at: string
}
```

`IDENTITY` 固定公开；v0 其余 Block 固定顺序为 `MY_TEA → MY_WORDS → TEA_PASSPORT`，默认关闭，不做拖拽排序。公开接口不复用私有响应模型，而是重新聚合允许字段：Passport 只保留茶、完成状态和无时间戳的数字标本。

分享撤销会移除当前 `public_id`；再次开启生成全新 capability。公开页始终实时读取 TeaProfile，因此编辑后同步生效，已撤销 ID 不会恢复。Profile 的编辑、分享、浏览和 CTA 服务不调用 Taste 更新、推荐或 Tea-BTI 写逻辑。

私有页面将同一份聚合数据投影为三层：`/profile` 的 Tea Identity Hero、我的茶迹与继续探索；`/profile/edit` 的资料/候选/分享范围编辑；`/profile/tea-bti` 的当前人格解读。内部 Block ID 和 `isPublic` 只服务数据与编辑流程，不出现在 `/profile` 浏览态。公开 `/p/{publicId}` 继续使用独立公开模型与既有页面。

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
- feed_headline
- feed_description
- scene
- emotion
- visual_metaphor
```

### 数据原则

客观信息：

> 来自可靠 / 官方资料。

LLM：

> 只负责翻译表达，不负责创造事实。

## 7.1 Visual Profile / 视觉资产契约

每款核心 Demo 茶必须有人工审核的 Visual Profile，用同一份配置连接 MBTI、识别式 Swipe、选择反馈、详情、Tea Realm、Passport 与 Tea-BTI 证据卡。`visual` 代表立体展示图，`detail_visual` 代表详情实拍图。

```ts
type VisualProfile = {
  primary_anchor_asset_id: string
  anchor_types: Array<
    | "tea_liquor"
    | "infusion"
    | "wet_leaf"
    | "dry_leaf"
    | "brewing_action"
  >

  structure_color: string
  structure_color_basis: string
  abstract_form: string
  abstract_form_basis: string
  atmosphere_cue: string
  atmosphere_is_metaphor: boolean

  evidence_refs: string[]

  overlay: {
    bottom_percent: number
    left_percent: number
    width_percent: number
    height_percent: number
    opacity: number
    atmosphere_opacity: number
  }
}

type VisualAsset = {
  source_kind: "ai_generated" | "self_shot" | "licensed_photo"
  authenticity_state: "synthetic_demo" | "documentary"
  rights_state: "owned" | "licensed" | "demo_only" | "unknown"
  rights_note: string
  master_path: string
  media_path: string
  crop_strategy: string
  role: "presentation" | "detail" | "realm"
  active: boolean
  source_url: string
  original_sha256: string
  master_sha256: string
  edit_chain: EditStep[]
  prompt_id: string
  sha256: string
}
```

Demo 规则：

- Visual Profile 与卡片视觉提前生成并本地缓存；
- 不让运行时 LLM 自由创造结构色、风味隐喻或产地场景；
- 当前 Feed 只读取 `role = presentation && active = true` 的八张立体图；
- `rights_state = unknown` 的资产不能进入正式生产构建；
- `authenticity_state = synthetic_demo` 的资产不能被描述为真实商品或纪实产地摄影；
- 原图、裁切图、成品图与 Tea ID 通过资产清单稳定关联；
- 外部 Visual Skill 只作为设计研究，不复制 Prompt，不作为产品依赖。

首批 Demo 的唯一配置源为 `assets/tea-visuals/manifest.json`，由 `manifest.schema.json` 校验；前端不得再维护一份手写映射。

完整视觉规则与质量门槛见：[Tea-BTI Tea Visual Grammar](../design/tea-visual-grammar.md)。

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

# 9. 识别式 Swipe Card 文案生成

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

- 必须显示茶名、茶类、产区和三项性格关键词；
- 不出现商品品牌、等级或价格；
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

底层从连续 Taste Vector 和探索行为投影到四个饮茶偏好轴，再按顺序组成四字母 Code：

| 轴 | 左侧（分数大于等于 0） | 右侧（分数小于 0） |
|---|---|---|
| 风味基调 | `F — Fresh 清鲜` | `M — Mellow 醇和` |
| 口感重量 | `L — Light 轻盈` | `R — Rich 浓郁` |
| 感知入口 | `S — Scent 香气先行` | `T — Taste 滋味先行` |
| 探索倾向 | `E — Explorer 尝新` | `C — Comfort 守味` |

投影继续由 `taste.py` 的既有 Taste Vector 规则计算；人格配置只解释结果，不进入推荐权重，也不改变用户落入各 Code 的阈值。

---

## Tea-BTI 名称生成

16 型人格名、简短气质和“茶桌精神速写”结构化内容由 `apps/api/data/tea-bti-personas.json` 唯一提供。API 启动时校验 F/M、L/R、S/T、E/C 的笛卡尔积恰好出现一次，并校验每型固定字段数量、对话结构、CP 存在且互为映射以及禁用表达；缺项、重复、未知 Code、空文案或单向 CP 都会阻止启动。运行时不允许 LLM 随机命名、生成段子或拼接回退名称。

| Code | Tea-BTI 人格 | 简短气质 |
|---|---|---|
| `FLSE` | **山雾漫游者** | 清鲜、轻盈，追着香气认识新茶 |
| `FLSC` | **春庭守香人** | 清鲜、轻盈，偏爱熟悉舒服的香 |
| `FLTE` | **清溪寻味者** | 清鲜、轻盈，喜欢探索细微滋味 |
| `FLTC` | **白露慢饮者** | 清鲜、轻盈，找到喜欢的便慢慢喝 |
| `FRSE` | **花岭猎香者** | 清鲜但有厚度，喜欢追逐强烈香气 |
| `FRSC` | **兰室藏香人** | 清鲜浓郁，偏爱稳定而有层次的香 |
| `FRTE` | **青岚探味者** | 清鲜饱满，喜欢挑战不同滋味结构 |
| `FRTC` | **松间守味人** | 清鲜饱满，偏爱有存在感的熟悉滋味 |
| `MLSE` | **暮野寻香者** | 温润轻盈，在柔和茶里不断寻找新香 |
| `MLSC` | **暖庭藏香人** | 温润轻盈，喜欢熟悉、安静的香气 |
| `MLTE` | **秋溪探味者** | 温润轻盈，更关注入口与回味变化 |
| `MLTC` | **暖盏慢饮者** | 温润轻盈，一杯喜欢的茶可以喝很久 |
| `MRSE` | **烟霞猎香者** | 醇和浓郁，喜欢大胆探索厚重香气 |
| `MRSC` | **炉火守香人** | 醇和浓郁，对熟悉的深香有稳定偏爱 |
| `MRTE` | **深山探味者** | 醇厚浓郁，专注复杂滋味和长尾韵 |
| `MRTC` | **炉火守夜人** | 醇厚浓郁，偏爱稳定、深沉、耐喝的茶 |

**山雾漫游者、白露慢饮者、花岭猎香者、暖盏慢饮者、深山探味者、炉火守夜人** 仅作为品牌演示与传播代表，不带特殊 UI 标记，也不参与算法优先级。

`TeaBtiResponse.personaDetail` 在 `early / stable` 返回对应静态内容，在 `forming` 返回 `null`。配置中的 `chemistry.partnerCode` 是事实源，API 根据同一配置补全 `partnerName`，避免重复维护名称。

`TeaBtiResponse.behaviorEvidence` 最多返回三条结构化真实事件。选择顺序为：最近一条有原话的品饮、不同茶的最近喜欢或收藏、不同茶的最近跳过；不足三条时按时间用其他真实事件补齐。响应只携带事件种类、茶摘要、可空用户原话和可空泡数，不虚构次数或停留时长。公开 Profile 使用独立 `PublicTeaBtiResponse`，不返回 `personaDetail` 或 `behaviorEvidence`，避免私有行为及原话越过分享边界。

前端 `/profile/tea-bti` 只消费上述确定性响应，形成中使用独立分支；已形成页面先呈现趣味栏目，再呈现完整四轴和真实证据。顶部入口复用 `ProfileShareSheet`，分享权限、链接复用、二维码、复制、系统分享和撤销逻辑保持单一实现。

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

形成态接口必须返回可执行进度，已形成状态返回 `null`：

```ts
formationProgress: {
  swipesCompleted: number
  swipesRequired: 5
  swipesRemaining: number
  positiveSignalCompleted: boolean
} | null
```

`forming` 文案组合“剩余选择数”与“是否还缺一次喜欢、收藏或真实品饮”；`early / stable` 不再返回形成进度。该结构只解释形成门槛，不改变 Taste Vector、四轴投影或稳定度计算。

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
feed_card_seen
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
realm_preview_opened
realm_started
realm_scene_completed
realm_interaction_fallback_used
realm_real_asset_revealed
realm_specimen_collected
realm_completed
passport_added
teabti_updated
tea_profile_viewed
profile_block_edited
tea_profile_shared
public_profile_opened
profile_cta_started
```

长期可以构建 Taste Graph。

---

# 19. API Contract v1

FastAPI / Pydantic 是契约唯一来源，公共字段使用 `camelCase`，所有业务接口使用 `/api/v1`。OpenAPI 3.1 快照和 TypeScript 类型通过 `make contract` 生成。

## 核心路由

```text
POST /sessions/anonymous
GET  /bootstrap
POST /onboarding/seed
GET  /feed
POST /swipes
GET  /teas/{teaId}
POST /drink-feedback
POST /taste/normalize
GET  /me/passport
PUT  /me/passport/{teaId}
GET  /me/tea-bti
GET  /me/profile
PUT  /me/profile
POST /me/profile/share
DELETE /me/profile/share
POST /me/profile/events
GET  /public/profiles/{publicId}
POST /public/profiles/{publicId}/events
```

## Tea Profile 分享

公开 Profile 路由无需匿名 Token，也不会创建匿名会话。`publicId` 是不可枚举的 unlisted capability，不是账号 ID；页面设置 `noindex/nofollow`，没有公开目录。客户端用当前 Origin 拼接 `/p/{publicId}`，优先 Web Share API，能力缺失时复制链接；二维码只编码同一 URL。

`PUT /me/profile`、`POST /me/profile/share` 和事件接口使用 `clientEventId` 幂等。`DELETE /me/profile/share` 通过 `X-Client-Event-Id` 传递幂等键。公开事件在服务端归因到分享所有者，但响应不返回所有者 ID。

## Tea Realm

```text
GET   /realms
GET   /realms/{realmId}
POST  /realms/{realmId}/start
PATCH /realms/{realmId}/progress
POST  /realms/{realmId}/events
POST  /realms/{realmId}/complete
```

`clientEventId` 在同一用户内幂等。Progress 只允许按七幕顺序推进；完成接口要求前六幕已完成，并原子返回进度、标本和 Passport 条目。客户端不能通过 Passport Update 修改 `realmUnlocked`。

## 实时语音

```text
POST  /voice/sessions               -> prepared + providerMode + 可选 RTC 短期凭证
POST  /voice/sessions/{id}/start    -> 前端入房后启动 AI
PATCH /voice/sessions/{id}/context  -> 显式同步泡茶阶段
POST  /voice/sessions/{id}/turns    -> 只提交最终字幕
POST  /voice/sessions/{id}/stop     -> 停止任务，返回 experienceCompleted + TeaJourney，并可选归一化 Taste 原话
```

RTC 只传输浏览器音频，原始音频不落库。本阶段不实现摄像头、图像上传、VLM 或 `/brew/frame`。

Brew 会话提前停止时只结束会话，不自动把 `brewStage` 改成 `complete`。Taste 会话没有用户确认原话时不调用归一化和 Passport 写入。

---

# 21. 缓存

48 小时不需要复杂 Redis。

可缓存：

- Tea Profile；
- 八茶识别式 Swipe Card；
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

## Feed Copy

提前生成。

## Tea-BTI

本地规则计算。

## Tea Realm

视觉和手势本地运行，每幕进度依赖轻量 API 确认。断网时停留在当前幕并提供重试，不调用 LLM 或外部模型。

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
- Voice。

## P2

- 完整聊天历史；
- 多 Tea Realm；
- B 端 Taste Graph Dashboard；
- 登录系统。

## 最低优先级

- 自营商城；
- 订单与支付；
- 库存、履约和售后。

---

# 25. 推荐 Repo 结构

```text
tea-bti/
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
│   ├── tea-realm/
│   └── tea-visuals/
│       ├── originals/
│       ├── cards/
│       └── manifest.json
│
└── docs/
    └── design/
        └── tea-visual-grammar.md
```

---

# 26. 技术叙事（答辩版）

不要说：

> “我们用了很多 AI。”

推荐说：

> **Tea-BTI 的 AI 分成三层。**
>
> 第一层是 Taste Vector：用户不填问卷，Swipe 和真喝反馈直接更新偏好。
>
> 第二层是 Multimodal Companion：当用户真正泡茶、品茶时，视觉和语音模型才出现，帮助用户完成第一次真实饮茶。
>
> 第三层是 Memory：喝过的茶进入 Tea Passport，并进一步形成 Tea-BTI 和 Taste Graph，让下一杯越来越准。
>
> **AI 不站在用户面前，而是藏在“刷、泡、品、记住”的每一个关键动作后面。**
