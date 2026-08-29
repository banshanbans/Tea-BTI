# Tea-BTI H5 Design QA

## Evidence

- Source visual truth: the read-only teammate prototype formerly kept at `tea -Tpti/index.html`; that checkout was removed after handoff, while the comparison captures below remain as historical QA evidence.
- Source captures: `docs/design/qa/tea-bti-h5/.design-qa-reference.png`, `docs/design/qa/tea-bti-h5/.design-qa-reference-feed.png`.
- Final implementation captures: `docs/design/qa/tea-bti-h5/.design-qa-implementation-final.png`, `docs/design/qa/tea-bti-h5/.design-qa-implementation-feed-final.png`.
- Full-view comparison evidence: `docs/design/qa/tea-bti-h5/.design-qa-launch-comparison-final.png`, `docs/design/qa/tea-bti-h5/.design-qa-feed-comparison-final.png`.
- Focused comparison evidence: `docs/design/qa/tea-bti-h5/.design-qa-launch-focus-final.png`, `docs/design/qa/tea-bti-h5/.design-qa-feed-focus-final.png`.
- Secondary screen evidence: `docs/design/qa/tea-bti-h5/.design-qa-secondary-screens.png`, covering tea detail, immersive voice, Tea Realm home and Tea Profile.
- Responsive evidence: `docs/design/qa/tea-bti-h5/.design-qa-320-feed.png`, `docs/design/qa/tea-bti-h5/.design-qa-430-feed.png`.
- Viewport: 390 × 844 CSS px for primary comparison; 320 × 844 and 430 × 844 for boundary checks.
- Density normalization: both source and implementation page contexts reported device pixel ratio 2; the in-app browser produced normalized 390 × 844 pixel captures, so comparison inputs are equal-sized 1:1 CSS-pixel outputs.
- States: brand launch, identified eight-tea Swipe, tea detail, pre-connection voice, Realm home, Realm scene 1 and private Tea Profile.

## Final Findings

No actionable P0, P1 or P2 differences remain.

- Fonts and typography: the implementation keeps the prototype's Song-style editorial display hierarchy, compact sans-serif UI labels and high-contrast headline rhythm. Brand and headline wrapping remain intentional at 320–430 px.
- Spacing and layout rhythm: the 390 px feed preserves a 16 px gap between the Swipe action row (`bottom: 750`) and persistent navigation (`top: 766`). No horizontal overflow was found at 320, 390 or 430 px.
- Colors and tokens: warm rice paper, ink green, leaf green, amber accents, soft borders and low-elevation shadows are consistently mapped across discovery, detail, Realm and Profile. The dark launch and voice surfaces are explicit product requirements.
- Image quality and assets: tea and Realm imagery continue to come from the registered backend manifest. Phosphor icons replace emoji and text-glyph controls. No placeholder boxes, handwritten SVG assets or fake camera visuals remain.
- Copy and content: `Tea-BTI` is the formal brand; “刷茶” remains only as the discovery action and navigation label. The duplicated `适合 适合…` copy was removed.
- Accessibility and interaction: primary controls are at least 44 px, focus-visible styling is present, reduced-motion rules are retained, and the flow does not request a camera. The clean final browser tab reported zero console errors.

## Intentional Product Differences From The Prototype

- The source landing is a warm static home screen; the implementation uses a dark Tea-BTI brand launch because the approved plan requires a launch screen on every home entry.
- The source jumps directly into Mock Swipe content; the implementation preserves the real MBTI → three-cup Seed → server-backed eight-tea Feed journey.
- The implementation uses the reviewed tea visual manifest and directly shows each tea name, tea type and personality keywords with its complete presentation artwork.
- The source uses emoji and character controls; the implementation uses a consistent rounded icon library and does not add the unsupported global tea-companion bubble.

## Comparison History

### Iteration 1 — blocked

Evidence: `docs/design/qa/tea-bti-h5/.design-qa-feed-comparison-1.png`.

- [P2] Swipe controls overlapped the persistent bottom navigation at 390 × 844.
- [P2] Scene copy could render as `适合 适合…` when the API value already contained the prefix.
- [P2] Scene typography was too large and competed with the card headline.
- [P2] The Next development indicator obscured the lower-left navigation area.

Fixes:

- Reduced the deck maximum height and allowed flex shrink so actions remain above navigation.
- Added conditional scene-prefix handling.
- Reduced scene copy to 22 px with a 1.35 line height.
- Disabled the development indicator in Next configuration.

### Iteration 2 — passed

Post-fix evidence: `docs/design/qa/tea-bti-h5/.design-qa-feed-comparison-final.png` and `docs/design/qa/tea-bti-h5/.design-qa-feed-focus-final.png`.

- Action row ends at 750 px and navigation starts at 766 px.
- Scene copy renders once and no longer dominates the card.
- No development indicator is present.
- 320, 390 and 430 px checks report zero horizontal overflow.

## Primary Interactions Tested

- Launch preload → start → MBTI or returning-user Feed recovery.
- MBTI skip → three Seed cards → identified eight-tea Feed.
- Tea detail routes and Brew/Taste/Realm entry affordances.
- Mock-capable immersive voice pre-connection state.
- Realm home and seven-scene V2 experience shell; seven progress dots present, no camera dependency, and optional local microphone volume detection always has a complete wipe fallback.
- Four-block Tea Profile layout and persistent navigation.

## Follow-up Polish

- No P3 item blocks this handoff. Future visual changes can follow the later high-fidelity prototype without changing the current service-backed boundaries.

final result: passed

## Tea Realm V2《雾里一芽》验收补充（2026-08-30）

- 视觉证据：`output/audit/tea-realm-v2-2026-08-30/realm-home-320.png`、`realm-home-390.png`、`realm-home-430.png` 和 `teacher-correction-390.png`。
- 320、390、430px 均完成七幕横向溢出检查；首页主按钮与底部导航在入场动画稳定后无重叠。
- Chromium 完成真实指针轨迹的杀青、揉捻、搓团与单指提毫降级，并以合成方向事件验证方向数据进入杀青，以本地合成音量验证吹气成功。
- WebKit 完成方向权限拒绝、麦克风拒绝后的触控降级旅程；Reduced Motion、刷新恢复、上一幕、重玩、重复完成和安全返回路径均保留。
- 茶师傅素材为根据参考重新生成的原创演示素材，原参考图未进入仓库；服饰不声明为任何特定民族的真实复原。三张运行 WebP 均为 720×1080，实际文件总量约 235KB，并通过 Manifest/API 按需读取。
- 自动化结果：品牌检查通过，API 93 项通过，Web 90 项通过，生产构建通过，Chromium/WebKit E2E 27 项通过、5 项按浏览器职责跳过。
- 浏览器控制台仅记录既有的 `/favicon.ico` 404；未发现 Tea Realm 运行时错误。
- iPhone Safari 与 Android Chrome 的方向灵敏度、真实吹气阈值、双指提毫和生命周期释放仍需真机验收，自动化结果不替代这四项。

Tea Realm V2 自动化与桌面双浏览器验收：passed；真机验收：pending。

## Tea Realm V2.1 双通道与连续反馈（2026-08-30）

- 入口新增互动/文字稿居中分流；只有互动主按钮会请求方向权限，文字稿不触发方向或麦克风。
- 拨雾后显示三个来自 Catalog 的可选资料光点，均关联农业农村部/标准证据，不阻塞下一幕。
- 蒸汽改为吹气、擦拭、直接开始三条等价路径；手势辅助严格在同一步三次未识别后出现。
- 起锅前不再明示三个结果窗口；锅内叶色、卷曲、聚拢和白毫反馈由最终提交的四手质量驱动。
- 文字稿完成和互动完成分别记录；默认阅读结局可被后续行为结局覆盖，标本保持唯一。
- 当前开放许可论文横图已降为可展开资料对照；在取得团队自有或明确许可的 1200px 以上干茶近景前，真实干茶主视觉验收仍为 pending。
