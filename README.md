# Tea-BTI

Tea-BTI 是一个面向原叶茶发现、体验与长期味觉身份产品。

它不要求用户先学习六大茶类、产区、工艺和专业术语，也不把“做一套茶人格测试”当作终点。用户可以从熟悉的 MBTI 语言开始，也可以直接跳过；系统用三杯不同角色的贵州茶完成破冰，再通过刷茶、收藏、真实冲泡、品饮反馈和用户自己的语言，逐渐形成连续的 Taste Vector。

当用户真正选中一杯茶，AI 才在最需要它的时刻出现：陪用户把茶泡好、把感受说清楚，并把“像雨后的草”“喝完嘴里甜甜的”这样的自然表达翻译成可理解的茶语。随后，Tea Realm 把杯中的味道连接到贵州山地、原料、工艺与人的经验；Tea Passport 保存真实喝茶经历；Tea-BTI 则把长期行为沉淀成一个可解释、可变化、可分享的个人茶主页。

- **公网体验：** [https://gks.socialdog.cn](https://gks.socialdog.cn)
- **项目 Tag：** `#Guikesong`

## 技术栈与技术选型

项目采用前后端分离的 TypeScript + Python 架构，以 OpenAPI 契约连接移动 H5 与 API 服务，并通过 Docker Compose 统一开发、测试和部署环境。

| 层级 | 技术 / 框架 | 版本 | 选型与职责 |
| --- | --- | --- | --- |
| Web 框架 | Next.js + React | 15.5.24 / 19.1.1 | App Router 移动 H5、服务端构建与 Standalone 生产运行 |
| 前端语言与样式 | TypeScript + Tailwind CSS | 5.8.3 / 3.4.17 | 静态类型约束、响应式界面与统一视觉样式 |
| 动效与状态 | Framer Motion + Zustand | 13.1.1 / 5.0.8 | Swipe、Tea Realm 等交互动效及轻量客户端状态管理 |
| 实时语音 | 火山引擎 RTC Web SDK | 4.66.20 | 浏览器入房及 AI 语音会话；无凭据时使用明确标注的演示模式 |
| API 框架 | FastAPI + Uvicorn | 0.116.1 / 0.35.0 | 异步 REST API、自动接口文档与 ASGI 服务 |
| 数据校验与配置 | Pydantic + pydantic-settings | 2.11.7 / 2.10.1 | 请求响应模型、环境变量与服务端配置校验 |
| 数据访问与迁移 | SQLAlchemy + Alembic | 2.0.43 / 1.16.5 | ORM、事务处理和可追踪数据库迁移 |
| 数据库 | SQLite / PostgreSQL（含 Supabase） | 可配置 | 本地默认 SQLite；通过 `DATABASE_URL` 切换生产数据库 |
| 前后端契约 | OpenAPI 3.1 + openapi-typescript | 3.1 / 7.9.1 | 从 FastAPI 规范生成 TypeScript 类型，减少接口漂移 |
| 工程与部署 | Docker Compose + npm workspaces + Make | Node.js 22 / Python 3.12 | Monorepo 依赖管理、容器化开发、测试、构建与部署 |
| 测试 | Pytest + Vitest + Testing Library + Playwright | 8.4.1 / 3.2.7 / 16.3.0 / 1.62.1 | 覆盖 API、组件、契约与 Chromium/WebKit 端到端流程 |

仓库采用 Monorepo 组织：`apps/web` 为 Next.js 前端，`apps/api` 为 FastAPI 后端，`packages/contracts` 保存 OpenAPI 快照、生成类型和 Fetch Client；`assets` 管理茶叶视觉与审核资料。
