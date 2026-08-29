# Tea-BTI

Tea-BTI 是一个移动端茶叶发现与 AI 语音陪伴产品：用户通过 MBTI 三杯破冰、八款贵州茶的识别式 Swipe 和真实饮用反馈逐步形成 Taste Profile，再进入陪泡、陪品、茶护照与“我的 Tea-BTI”。

## 当前实现

- Next.js 15 + React 19 移动 H5，已按同伴原型升级为 Tea-BTI 暖米白/墨绿视觉系统，重点适配 390×844，并兼容 320–430px。
- 每次进入首页先展示 Tea-BTI 品牌启动页；新用户进入 MBTI 三杯破冰，老用户恢复八杯 Feed，分享访客强制重新破冰但不清空原记录。
- FastAPI + SQLAlchemy + Alembic，本地默认 SQLite，通过 `DATABASE_URL` 切换 PostgreSQL/Supabase。
- 八款茶的审核资料、结构化冲泡指南、九维向量和完整 16 型 MBTI Seed；立体展示图与详情实拍图的视觉映射只读取 `assets/tea-visuals/manifest.json`。
- 二阶段语音会话契约：准备 RTC 凭证 → 前端入房 → 后端启动 AI。无凭据时明确进入浏览器演示模式。
- Tea Realm《雾里一芽》七幕纵向切片：刷新恢复、方向/拖拽降级、真实干茶 Reveal、“白毫”数字标本、Passport 和黔南点亮。
- Tea Realm 进度由服务端拥有；完成和标本发放幂等，不改变 Taste Vector 或 Tea-BTI 。
- Tea Profile v0 四 Block：基于真实证据选择本命茶与公开原话，支持可见性控制、确定性分享预览和二维码。
- 不可枚举、可撤销的公开 Profile：旧链接即时失效，再次分享旋转 ID；好友 CTA 可重新进入三杯破冰且不清空原记录。
- OpenAPI 3.1 快照、自动生成的 TypeScript 类型和轻量 Fetch Client。

## 启动

需要 Docker Desktop。本机 Node/Python 版本不参与运行时：

```bash
cp .env.example .env
make dev
```

打开 `http://localhost:3000`；API 文档为 `http://localhost:8000/docs`。

## 常用命令

```bash
make migrate       # Alembic 迁移
make contract      # 刷新 OpenAPI 和 TypeScript 类型
make brand-check   # 检查正式工程中的旧品牌残留
make api-test      # FastAPI 单元/契约测试
make web-test      # 前端组件测试
make e2e           # Docker 整栈 + Chromium/WebKit 端到端
make build         # Docker 镜像构建
```

完整契约、错误码、Tea Profile 隐私白名单、Tea Realm 进度和语音时序见 [docs/api-contract.md](docs/api-contract.md)。Tea Realm 资产的生成/纪实边界与许可见 [assets/tea-visuals/provenance.md](assets/tea-visuals/provenance.md)。

本轮 H5 原型对照、响应式证据和修复历史见 [design-qa.md](design-qa.md)。同伴原型目录 `tea -Tpti` 只读保留，不参与品牌残留检查和正式运行时。

## 真实语音开通清单

1. 开通火山“AI 音视频互动方案”，获取该应用的 RTC AppId / AppKey。
2. 创建 IAM AK/SK，供后端签名调用 `StartVoiceChat 2025-06-01`。
3. 从控制台“代码示例”复制包含 ASR、TTS、`LLMConfig.ModelName` 的 Config 模板，写入 `RTC_VOICE_CONFIG_JSON`。
4. 如需 Taste 文本归一化，另行配置方舟 `ARK_API_KEY` 和文本模型 ID；语音链路不再要求独立方舟 Endpoint Key。
5. 把 `.env.example` 中对应值放到服务端 `.env`；不要使用 `NEXT_PUBLIC_*` 暴露任何长期凭据。
6. `AI_MODE=auto` 只有在全部配置齐全且 API 版本为 `2025-06-01` 时才从会话创建阶段启用真实 RTC；否则返回明确标注的演示能力。真实会话一旦创建，运行故障不会再降级成 Mock。`AI_MODE=volcengine` 用于生产真实链路强制校验。

默认测试不调用真实火山服务。真实语音冒烟需在凭据配置后单独执行，不应在 CI 中声称已验证。

## 产品与文档

- [黑客松快速上线规范](docs/hackathon-quick-deployment.md)
- [产品需求文档](tea-bti_PRD.md)
- [商业模型与验证路线](docs/business-model.md)
- [完整贵州地图方向：贵州茶脉探索图](docs/guizhou-tea-map-direction.md)
- [技术架构](tea-bti_technical_architecture.md)
- [API 契约](docs/api-contract.md)

商业策略明确区分“验证交易价值”和“开发交易系统”：First 3 可通过外部收款与合作方履约测试，正装成交可先使用官方链接或导购码；商城、订单与支付保持全产品最低开发优先级。
