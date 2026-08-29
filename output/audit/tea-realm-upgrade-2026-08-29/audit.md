# Tea Realm 同伴方案迁移验收

验收日期：2026-08-29
运行环境：隔离 worktree 的本地 Docker Web + API
浏览器：Chromium、WebKit

## 结论

同伴分支中的六张生成素材和场景反馈已手工迁移到当前 Realm 架构。七幕编号、文案、服务端进度、完成幂等、来源返回、上一幕、异常重试、静音、跳过动画和 Reduced Motion 均保留；数据库、迁移与 OpenAPI Schema 未改变。

六张运行 WebP 合计 424,466 bytes（约 415 KiB），低于 1.5 MB 目标。运行时 URL 均由 Realm Manifest/API 返回，不存在 `/realm/*.png` 硬编码。

## 视觉与响应式证据

- [320px 茶境首页](realm-home-320.png)：修复后首页 CTA 与固定底部导航保留 28.2px 间距。
- [390px 摘芽](pick-bud-390.png)：四张芽叶示意图完整显示，文字和控制区无横向溢出。
- [430px 一口锅](wok-craft-430.png)：蒸汽、叶片、四步进度与交互区可见。
- [320px 标本](specimen-320.png)、[390px 标本](specimen-390.png)、[430px 标本](specimen-430.png)：标本与收藏按钮均未被遮挡。

受控浏览器逐幕测量覆盖 320、390、430px 下的首页与七幕，共 24 个页面状态：全部 `scrollWidth === innerWidth`。七幕没有底部导航；可见操作区未与其他固定控制重叠。首次测量发现首页 CTA 会进入底部导航区域，调整卡片操作区后复测通过；320、390、430px 的安全间距分别为 28.2、21.2、13.0px。

## 自动化结果

- API Realm/资产测试：8 passed。
- Web 组件测试：72 passed，其中 Realm 视觉控制器与体验 11 passed。
- Next.js 生产构建：通过。
- Chromium + WebKit 完整 E2E：16 passed（全新测试数据库、`AI_MODE=mock`）。
- 品牌残留检查：通过。

新增或强化的回归覆盖包括：六张素材由 API URL 注入、茶汤重复点击只推进一次、失败停留与重试、芽叶错误/正确/上提状态、人的经验无自动倒计时、炒茶循环卸载清理、拖拽降级、Reduced Motion、刷新恢复、上一幕回看、重玩与重复完成。

## 素材边界

茶汤、波纹和四张芽叶均为 `ai_generated / synthetic_demo / demo_only`，只承担交互示意，不作为真实都匀毛尖形态、工艺或产区事实证据。真实干茶仍使用现有开放许可论文图，并继续显示“论文样本与商品批次无关”的边界说明。

## 非本次范围

- 未合入同伴分支的 Profile、Voice、旧 API 路由、旧原型目录或文档结构。
- 未修改 `origin/codex/tea-bti` 历史。
- 未执行公网生产部署。
