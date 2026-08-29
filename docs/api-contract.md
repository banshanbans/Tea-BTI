# Tea-BTI API Contract v1

FastAPI/Pydantic 是公共契约的唯一来源。提交物包含：

- `packages/contracts/openapi.json`：OpenAPI 3.1 快照。
- `packages/contracts/src/schema.ts`：由 `openapi-typescript` 生成，不手写。
- `packages/contracts/src/client.ts`：处理 Bearer Token 与统一错误的 Fetch Client。

所有业务接口使用 `/api/v1`，JSON 字段为 `camelCase`。除创建匿名会话、能力查询和 `/public/profiles/*` 公开 Profile 接口外，请求应携带：

```http
Authorization: Bearer <anonymousAccessToken>
```

## 错误结构

```json
{
  "error": {
    "code": "VOICE_PROVIDER_UNAVAILABLE",
    "message": "实时语音暂不可用",
    "requestId": "b9b27df1-2d38-45a4-b9e1-7ce7ec3bdb04",
    "retryable": true,
    "details": {}
  }
}
```

常用错误码：

| Code | HTTP | 含义 |
|---|---:|---|
| `AUTH_REQUIRED` / `AUTH_INVALID` | 401 | 缺少或无效的匿名 Token |
| `VALIDATION_ERROR` | 422 | 请求字段不符合 Pydantic 契约 |
| `INVALID_CURSOR` | 400 | Feed 游标不可解析 |
| `CARD_NOT_FOUND` / `TEA_NOT_FOUND` | 404 | 卡片或茶资料不存在 |
| `REALM_NOT_FOUND` | 404 | 茶境不存在 |
| `REALM_SCENE_OUT_OF_ORDER` | 409 | 尝试跳过或错序完成场景 |
| `REALM_COMPLETION_INCOMPLETE` | 409 | 前六幕未完成，不允许收藏标本 |
| `PROFILE_TEA_NOT_ELIGIBLE` | 409 | 本命茶不在当前用户的真实行为候选中 |
| `PROFILE_QUOTE_NOT_OWNED` | 409 | 原话来源不属于当前用户或不是已保存反馈 |
| `PROFILE_BLOCK_INCOMPLETE` | 409 | 准备公开的 Block 缺少必需内容 |
| `PUBLIC_PROFILE_NOT_FOUND` | 404 | 分享 ID 不存在、已撤销或已失效 |
| `VOICE_SESSION_ACTIVE` | 409 | 当前用户已有活动语音任务 |
| `VOICE_SESSION_STATE` | 409 | 语音会话状态不允许当前操作 |
| `VOICE_PROVIDER_UNAVAILABLE` | 503 | 真实语音强制模式配置不全或启动失败 |
| `VOICE_CONTEXT_UPDATE_FAILED` | 503 | 实时 AI 上下文更新失败 |

## 业务接口

| Method + Path | 请求 | 返回 |
|---|---|---|
| `POST /sessions/anonymous` | 无 | `userId`, `accessToken`, `createdAt` |
| `GET /bootstrap` | 无 | MBTI、恢复状态、Swipe 进度、Taste Profile、AI 能力 |
| `POST /onboarding/seed` | `{ "mbti": "INFP" }` 或 `null` | 已揭示的 `mirror/surprise/contrast` 三杯 |
| `GET /feed?cursor&limit` | 游标分页 | 不含茶名或 `teaId` 的 `BlindCard[]` |
| `POST /swipes` | `clientEventId`, `cardId`, `like/skip/save` | 幂等结果、Taste、可选 Reveal/推荐 |
| `GET /teas/{teaId}` | 无 | 审核资料、冲泡指南、视觉、可空 `realmId` 及服务端派生的 `journey` |
| `POST /drink-feedback` | 茶、喜欢/中立/不喜欢、泡数 | Taste 和 Passport 更新 |
| `POST /taste/normalize` | 茶、用户原话、泡数 | 允许列表标签、解释、AI/Mock 模式 |
| `GET /me/passport` | 无 | 茶护照，包含茶境首次完成时间和数字标本 |
| `PUT /me/passport/{teaId}` | 收藏、泡过、品过等部分更新 | 更新后的条目；不接受客户端写入 `realmUnlocked` |
| `GET /me/tea-bti` | 无 | 状态、Code、Persona、四轴与证据 |
| `GET /capabilities` | 无 | `voice: real/mock/unavailable` 及缺失配置名，不含密钥 |

Swipe 示例：

```json
{
  "clientEventId": "31a84e42-e88c-4810-bf9b-92221e776944",
  "cardId": "card_2d0b6fbc16a13a74d02a",
  "action": "like"
}
```

`clientEventId` 在同一用户内唯一；重试同一事件不重复更新 Taste。第 5 次有效 Swipe 后返回一次基于行为证据的推荐。

### 单茶 Journey

`TeaJourneyResponse` 是 Passport 与 Realm Progress 的只读派生视图，不单独落库：

```json
{
  "teaId": "duyun-maojian",
  "brewed": true,
  "tasted": true,
  "realmId": "duyun-maojian-mist-bud",
  "realmCompleted": false,
  "nextStep": "realm"
}
```

`nextStep` 固定取 `brew → taste → realm → passport` 中第一个未完成阶段；茶品没有 Realm 时自动跳过。该字段只决定推荐下一步，不阻止用户自由进入 Taste 或 Realm。

## Tea Profile 与可撤销分享

个人 Tea Profile 固定按 `IDENTITY → MY_TEA → MY_WORDS → TEA_PASSPORT` 聚合。`IDENTITY` 始终公开，其他 Block 默认关闭；本阶段不支持拖拽排序。Profile 编辑、创建/撤销分享、公开页浏览和 CTA 均不写入 Taste Vector，不改变推荐或 Tea-BTI 四轴。

| Method + Path | 鉴权 | 行为 |
|---|---|---|
| `GET /me/profile` | Bearer | 返回私有设置、四个 Block、Tea-BTI 、真实茶/原话候选、Passport 与分享状态 |
| `PUT /me/profile` | Bearer | 更新昵称、简介、候选内本命茶、带来源的公开原话与公开 Block；`clientEventId` 幂等 |
| `POST /me/profile/share` | Bearer | 生成或返回当前不可枚举链接；撤销后再次开启会旋转 `publicId` |
| `DELETE /me/profile/share` | Bearer | 使用 `X-Client-Event-Id` 幂等撤销；旧地址立即失效 |
| `POST /me/profile/events` | Bearer | 只接受 `tea_profile_viewed` |
| `GET /public/profiles/{publicId}` | 无 | 只返回用户允许公开的 Block；实时读取当前 Profile |
| `POST /public/profiles/{publicId}/events` | 无 | 只接受 `public_profile_opened / profile_cta_started`，按分享所有者归因 |

编辑请求示例：

```json
{
  "clientEventId": "593442c0-cfa0-4e90-9e5c-2be2bb9cd76d",
  "displayName": "山边喝茶的人",
  "bio": "在清鲜和回甘之间，慢慢找到自己的这一杯。",
  "selectedTeaId": "duyun-maojian",
  "sourceFeedbackId": "6e930f18-1182-4d4b-9cf2-3168aa9ce72d",
  "publicQuote": "像雨后刚打开的窗，尾巴有一点甜。",
  "publicBlockIds": ["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"]
}
```

本命茶候选只来自喜欢/收藏 Swipe、Drink Feedback 或 Passport；原话候选只来自当前用户已确认保存且包含 `userWords` 的反馈。公开编辑版本保留 `sourceFeedbackId`，不会回写原始反馈。

公开 Passport 响应使用独立白名单，只含茶摘要、`saved/brewed/tasted/realmUnlocked` 状态和无时间戳的数字标本。它不包含 `userId`、反馈 ID、精确饮用/收集时间、完整饮用历史、用户私密描述或字幕。

`publicId` 由至少 128-bit 的服务端安全随机数生成。每位用户同一时间只有一个活动链接；撤销时服务端清除旧 capability，再次分享生成全新 ID。公开页面声明 `noindex / nofollow`，系统不提供公开目录或搜索入口。

## Tea Realm

`realmId=duyun-maojian-mist-bud` 是首个稳定章节 ID。茶境随时可进入，不以 Swipe、Brew、Taste 或购买为门槛。

| Method + Path | 行为 |
|---|---|
| `GET /realms` | 返回茶境列表、进度、标本与已点亮区域 |
| `GET /realms/{realmId}` | 返回静态 Definition、当前进度和个性化开场；无 Taste 原话时只用审核默认文案 |
| `POST /realms/{realmId}/start` | 记录 `interactionMode`、降级原因与重玩；`clientEventId` 幂等 |
| `PATCH /realms/{realmId}/progress` | 提交一幕完成与耗时；只允许按 Definition 顺序推进 |
| `POST /realms/{realmId}/events` | 只接受预告打开、交互降级与真实资产 Reveal 三类客户端事件 |
| `POST /realms/{realmId}/complete` | 前六幕完成后，原子写入完成进度、“白毫”标本、Passport 和黔南点亮状态 |

进度状态为 `available / in_progress / completed`；交互模式为 `orientation / pointer / reducedMotion`。完成写入和标本发放均幂等，重玩不清除首次完成时间。Tea Realm 不写入 Taste Vector，不改变 Tea-BTI 。

```json
{
  "clientEventId": "0eff22bc-27d0-4e2a-85d4-13639fc909cf",
  "completedScene": "mist-mountain",
  "elapsedMs": 8400
}
```

## 语音会话

```text
POST /voice/sessions
  └─ prepared + providerMode + (真实模式) RTC 短期入房参数
       └─ 前端成功入房
            └─ POST /voice/sessions/{id}/start
                 └─ active
                      ├─ PATCH /context
                      ├─ POST /turns
                      └─ POST /stop → completed
```

| Method + Path | 行为 |
|---|---|
| `POST /voice/sessions` | `{ mode: "brew" | "taste", teaId }`；创建最长 10 分钟会话 |
| `POST /voice/sessions/{id}/start` | 前端入房后启动 AI；重复调用幂等 |
| `PATCH /voice/sessions/{id}/context` | 同步 `brewStage` 和 `infusionNumber`，不暗示视觉识别 |
| `POST /voice/sessions/{id}/turns` | 只提交最终字幕，`clientTurnId` 去重 |
| `POST /voice/sessions/{id}/stop` | 停止 AI；返回 `experienceCompleted` 和最新 `journey`；Taste 模式可保存用户确认原话并返回归一化结果 |

状态只使用 `prepared / active / stopping / completed / failed / expired`。同一用户同时只允许一个活动语音会话。Brew 只在 `brewStage=complete` 时写入“已泡过”；Taste 只在存在用户确认原话时写入“已品过”。不保存原始音频；最终字幕是最多 24 小时的运行数据，用户确认的原话和归一化标签才进入 Passport。

## 契约刷新

```bash
make contract
```

这会先从 FastAPI 导出 OpenAPI，再生成 TypeScript。后端字段变更后必须同时提交两个生成文件。
