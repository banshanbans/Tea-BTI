# Tea-BTI · 让茶先懂你

> 一款移动端茶叶发现与 AI 语音陪伴产品：不先问你懂不懂茶，而是用「刷、泡、品、记住」四件事，帮你找到属于自己的第一杯原叶茶。

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js%2015-000000?style=for-the-badge&logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white">
  <img alt="SQLAlchemy" src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white">
</p>

---

## 这是什么

传统茶商品往往从产区、工艺、等级开始介绍，要求用户「先懂茶再购买」。Tea-BTI 反过来：**用户不填问卷，不背术语，用真实的选择与饮用行为，慢慢长出一份自己的茶味身份（Tea-BTI）。**

一句话：**「不用先懂茶，先喝三杯。」**

---

## 体验闭环

```text
MBTI 三杯破冰 ──▶ Blind Swipe 盲刷 ──▶ Brew 陪泡 ──▶ Taste 陪品
        │                                        │
        ▼                                        ▼
   Taste Vector（口味向量）◀─────────── 真实饮用反馈（真喝权重大于刷茶）
        │
        ├──▶ Tea Realm《雾里一芽》文化沉浸
        ├──▶ Tea Passport 茶护照
        └──▶ 我的 Tea-BTI（四轴人格）
```

- **三杯破冰**：MBTI 只负责降低「第一次选什么」的心理成本，不进入口味向量。
- **Blind Swipe**：不看茶名、品牌、茶类，只凭感官与情绪盲刷，快速探测口味边界。
- **Taste Vector**：9 维感官向量，由「喜欢/跳过/收藏/真喝反馈」加权更新，可解释、不伪精确。
- **Tea Realm**：七幕纵向切片，把「这一口从哪里来」讲成一个不到一分钟的沉浸体验。
- **Tea Passport**：喝过的茶、说过的话、收藏的标本，都留存在护照里。
- **Tea-BTI**：四个轴把口味向量投影成一种「茶味人格」，而不是让 LLM 随机命名。

---

## 功能亮点

- 🫖 **移动 H5**：Next.js 15 + React 19，暖米白/墨绿视觉，适配 390×844，兼容 320–430px。
- 🎴 **盲刷卡片**：卡片视觉只读 `assets/tea-visuals/manifest.json`，`blind_safe` 资产才进 Feed。
- 🗣️ **AI 语音陪伴**：火山 RTC + 方舟 LLM 二阶段会话（准备凭证 → 入房 → 启动 AI），无凭据自动降级为浏览器演示模式。
- 🏔️ **Tea Realm《雾里一芽》**：刷新恢复、方向/拖拽降级、真实干茶 Reveal、白毫数字标本、黔南点亮。
- 📒 **Tea Profile**：基于真实证据选本命茶与公开原话，可撤销、不可枚举的分享链接 + 二维码。
- 🔐 **隐私优先**：匿名会话 Token 哈希落库；原始音频不落库；字幕按 TTL 自动清理；凭据不进 `NEXT_PUBLIC_*`。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 15 · React 19 · TypeScript · Tailwind CSS · Framer Motion · Zustand |
| 后端 | FastAPI · Python 3.12 · Pydantic · SQLAlchemy · Alembic |
| 数据 | SQLite（默认）/ PostgreSQL（`DATABASE_URL` 切换） |
| 契约 | OpenAPI 3.1 → 自动生成 TypeScript 类型 + Fetch Client |
| AI | 火山 RTC + 方舟 LLM（可降级为规则 Mock） |
| 部署 | Docker Compose（前后端一体化） |

---

## 快速开始

需要 Docker Desktop（本机 Node/Python 版本不参与运行时）。

```bash
cp .env.example .env     # 首次
make dev                 # 或 docker compose up --build
```

- 前端 H5：http://localhost:3000
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/healthz

**Windows 一键启动**（自动拉起 Docker Desktop、缺 `.env` 自动创建）：

```powershell
.\start.cmd
```

> 语音凭据留空时，`AI_MODE=auto` 会自动进入**浏览器演示模式**，无需真实火山服务即可跑通全部体验。

---

## 常用命令

```bash
make migrate       # Alembic 迁移
make contract      # 刷新 OpenAPI + TypeScript 类型
make brand-check   # 检查旧品牌残留
make api-test      # FastAPI 单元/契约测试
make web-test      # 前端组件测试
make e2e           # Docker 整栈 + Chromium/WebKit 端到端
make build         # Docker 镜像构建
```

---

## 目录结构

```text
tea-bti/
├── apps/
│   ├── web/          # Next.js 移动 H5
│   └── api/          # FastAPI + Alembic
├── packages/
│   └── contracts/    # OpenAPI 生成的 TS 类型 + Fetch Client
├── assets/
│   └── tea-visuals/  # 茶视觉资产 + manifest（单一视觉配置源）
├── docs/             # 契约、商业模型、设计文档
└── scripts/          # 一键启动、品牌检查、e2e
```

---

## 文档

- [产品需求文档](tea-bti_PRD.md)
- [技术架构](tea-bti_technical_architecture.md)
- [API 契约](docs/api-contract.md)
- [商业模型与验证路线](docs/business-model.md)
- [贵州茶脉探索图方向](docs/guizhou-tea-map-direction.md)
- [茶视觉语法](docs/design/tea-visual-grammar.md)

---

## 产品原则

> **AI 不站在用户面前，而是藏在「刷、泡、品、记住」的每一个关键动作后面。**

- LLM 只负责「翻译表达」，不负责「创造事实」。
- 真喝反馈的权重大于 Swipe；MBTI、地图、Realm 不污染 Taste Vector。
- 不伪装精确：没有传感器就不声称「87.3°C / 4.8g」。
- 可降级：断网时核心旅程不被外部模型打断。

---

## License

当前未指定开源许可证，代码仅作展示与开发用途。