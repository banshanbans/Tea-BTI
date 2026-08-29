export const meta = {
  name: 'shuacha-nextjs-migration',
  description: 'Migrate the shuacha single-file HTML prototype into a Next.js 15 + React 19 + Framer Motion + Zustand app',
  phases: [
    { title: 'Foundation' },
    { title: 'Features' },
    { title: 'Integrate' },
  ],
};

// 共享上下文，注入每个 agent 的 prompt
const CTX = `
项目背景：《刷茶》——一个让年轻人第一次进入原叶茶世界的移动端 Web App。
核心 slogan：「你不用先懂茶。刷几下，茶先开始懂你。」产品闭环：Discover → Brew → Taste → Explore → Remember → Evolve。

你正在把一个【已经完成并验证过的单文件 HTML 原型】迁移成 Next.js 工程。
- 原型文件（唯一视觉/文案/交互真相来源，必须逐字复刻其中的中文文案与视觉）：c:/Users/18984/Desktop/新建文件夹 (2)/index.html
- 前端规格：c:/Users/18984/Desktop/新建文件夹 (2)/shuacha_stitch_frontend_prompt.md
- 技术架构：c:/Users/18984/Desktop/新建文件夹 (2)/shuacha_technical_architecture.md
- Next.js 工程根目录：c:/Users/18984/Desktop/新建文件夹 (2)/apps/web

工程已就绪：Next.js 15.5.24 + React 19 + TypeScript 5.9 + Tailwind CSS 4（CSS-first，@import "tailwindcss"）+ Framer Motion 12 + Zustand 5。依赖已安装（node_modules 存在）。
路径别名 "@/*" 指向 apps/web/src/*。
注意：Windows 环境，文件路径含中文与空格，所有工具调用请使用【绝对路径】。

关键视觉原则（迁移时严格遵守）：
- 暖白米白背景 #F7F3EA、深墨绿文字 #1F3D2B、嫩叶绿强调 #6F9A4E、茶汤琥珀 #C99A5B，禁用大红大金。
- 标题用衬线（Songti SC / Noto Serif SC / SimSun），正文用系统无衬线（PingFang SC / Microsoft YaHei），禁用 Inter。
- 移动端优先；桌面端(>=1000px)做「居中手机 + 两侧品牌/状态栏」三栏布局（原型已实现，需复刻）。
- 所有中文文案必须与 index.html 完全一致，不得使用 Lorem ipsum 或英文占位。
`;

const FOUNDATION_PROMPT = `${CTX}

你的职责（Phase 1 · Foundation）：建立所有 feature 依赖的基础契约。请按顺序完成，全部使用绝对路径。

先读 index.html 全文（重点：<style> 里的全部 CSS、<script> 里的 TEAS 数据对象与 App 状态对象、<body> 里的 DOM 结构、底部导航/浮动茶伴/桌面侧栏的 HTML）。

然后创建以下文件：

1) apps/web/src/app/globals.css —— 迁移 index.html 的 <style> 全部内容（保留 :root CSS 变量、全部组件 class 名、@keyframes、媒体查询、桌面三栏 @media (min-width:1000px) 规则、.stage/.side 侧栏样式）。文件顶部保留 @import "tailwindcss"; 后接全部自定义 CSS。不要删改任何 class 名。

2) apps/web/src/lib/types.ts —— 定义 TypeScript 类型。至少包含：
   export type TeaId = 'duyun' | 'meitan' | 'zunyi' | 'puan' | 'leishan';
   export type Screen = 'launch'|'swipe'|'detail'|'brew'|'taste'|'realm'|'chapter'|'ending'|'profile'|'teabti'|'passport';
   export type Tab = 'swipe'|'realm'|'profile';
   export interface Tea { id, name, region, type, emoji, blind:{headline,desc,tags,scene,art}, pro:{tags,sensory,brewing,origin,process,translate} }

3) apps/web/src/lib/teas.ts —— 把 index.html 里 TEAS 对象的 5 款茶（duyun 都匀毛尖 / meitan 湄潭翠芽 / zunyi 遵义红 / puan 普安红 / leishan 雷山银球茶）逐字迁移成 typed 的 TEAS 常量，并导出 FEED_ORDER 数组。文案一字不差。

4) apps/web/src/stores/app-store.ts —— 用 Zustand 迁移 index.html 里 App 对象的状态与行为。必须导出 useAppStore（用 zustand 的 create）。状态字段（初始值）：
   currentScreen:'launch', currentTab:'swipe', feedIdx:0, swipeCount:0, likes:[] as string[], skips:[] as string[], currentTea:'duyun', brewStep:2, chapter:0, chapterDone:[false,false,false,false], passport:[] as string[], revealTea:null as string|null, showSummary:false, showCompanion:false, helpOpen:false
   动作（与 index.html App 方法一一对应，逻辑等价）：go(screen)、tab(name)、swipe(action)、openReveal(teaId)、closeReveal(next)、openSummary()、closeSummary(again)、openDetail(id)、enterBrew()、brewNext()、resetTaste()、tasteSpeak()、tasteRate(val)、markTasted()、openCompanion()、closeCompanion()、startChapter()、chapterNext()、addPassport()、toggleHelp()、setScreen(name)。
   reveal 逻辑：swipe('like') 时设置 revealTea=该茶 id 并 currentTea；swipe('skip') 后 feedIdx+1、swipeCount+1，且 swipeCount>=5 时 showSummary=true。closeReveal('detail') 时 openDetail + currentScreen='detail'。请务必复刻 index.html 里这些方法的完整逻辑（含 maybeSummary 触发条件、renderBrew 的 steps/says 数组、chapterData 四阶段文案、markTasted 把 currentTea 加入 passport 等）。

5) apps/web/src/components/ui.tsx —— 通用 UI 组件（用 globals.css 的 class，勿重复造样式）：Pill、Tag（含 tag-amber 变体）、Eyebrow、IconButton、BackButton。都用普通函数组件，接受 className 合并。

6) apps/web/src/components/BottomNav.tsx —— 底部三 Tab（刷茶/茶境/我的），从 useAppStore 读 currentTab 高亮，onClick 调 tab()。结构/class 复刻 index.html 的 .bottomnav。

7) apps/web/src/components/FloatingCompanion.tsx —— 右下角浮动「茶伴」按钮 + 点击打开的 Companion Drawer（bottom sheet，含「正在聊：都匀毛尖」、三个快捷问题、conversation 区域、历史入口）。从 store 读 showCompanion。快捷问题答案文案复刻 index.html 的 companionAnswer 映射。

8) apps/web/src/components/DesktopSidebar.tsx —— 桌面端左右侧栏（.side-left 品牌 + .side-right 状态卡）。右栏茶护照计数读 store.passport.length，Tea-BTI 四轴用与 index.html sideAxesHTML 相同的数据(轻盈/饱满24、清鲜/温熟18、甜润/劲爽32、干净/绵长71)。

9) apps/web/src/components/LaunchScreen.tsx —— 入口页（Logo + slogan + 开始刷茶按钮 + 「不需要做测试」）。按钮 onClick 调 store.go('swipe')。文案复刻 index.html .launch-* 部分。

10) apps/web/src/app/layout.tsx —— 重写：根 html/body，body 内用 .stage 包裹 {children} 与 <DesktopSidebar />（左右侧栏），保证桌面三栏、移动全屏（与 index.html 的 .stage 结构一致）。保留 metadata（title「刷茶 · 你不用先懂茶」）。引入全局字体声明（在 globals.css 里用 CSS 变量 --serif/--sans 即可，无需下载 webfont）。

11) apps/web/src/app/page.tsx —— 写一个主页面框架：一个 "use client" 组件，从 useAppStore 读 currentScreen，用一个 switch 渲染各 screen。由于 feature 组件由其他 agent 并行实现，你现在【先用 TODO 注释占位】标出要 import 的组件名，并渲染一个临时的占位 div 显示当前 screen 名。必须 export 明确的占位，例如：
    const SCREEN_COMPONENTS: Partial<Record<Screen, React.ComponentType>> = { launch: LaunchScreen, swipe: ()=>null /* TODO feature/swipe */, detail: ()=>null, ... }
    并挂载 <BottomNav/>（非 launch/brew/taste 时显示）与 <FloatingCompanion/>。
    （Integrate 阶段会补全这些占位。）

完成后，运行：cd apps/web && npx tsc --noEmit 做一次类型自检，修复你引入的类型错误。然后返回一段结构化文字报告：
- 你创建的文件清单
- useAppStore 导出的状态字段与动作签名（供 feature agent 对齐）
- globals.css 里可用的主要 class 名清单（供 feature agent 引用）
- teas.ts 导出的 TEAS/FEED_ORDER 结构
- tsc 结果（通过/报错摘要）
`;

const FEATURE_TEMPLATE = (label, detail, files, readHint) => `${CTX}

你的职责（Phase 2 · Features · ${label}）：在 Foundation 已建立的基础上实现一个 feature 模块。

先读这些文件了解契约（全部用绝对路径）：
- apps/web/src/lib/types.ts（类型）
- apps/web/src/lib/teas.ts（TEAS/FEED_ORDER 数据）
- apps/web/src/stores/app-store.ts（useAppStore 的 state 与 actions）
- apps/web/src/app/globals.css（可用的 class 名）
- apps/web/src/components/ui.tsx（通用组件）
${readHint}
然后按 index.html 的对应 section 逐字复刻文案与视觉，实现以下文件（每个文件是 "use client" 组件，用 globals.css 的 class + framer-motion 做手势/过渡动画）：

${files}

${detail}

实现要求：
- 中文文案与 index.html 完全一致（一字不差），不要占位英文。
- 所有交互走 useAppStore 的 actions（不要自建重复状态）。
- 每个 feature 目录内默认导出一个主 Screen 组件，并额外命名导出内部子组件（便于 Integrate 与复用）。
- framer-motion 只用于 swipe 拖拽（跟随/旋转/回弹）、reveal/sheet 的进出场、Tea-BTI 轴填充等需要手势或过渡的地方；简单显示用 CSS 即可。
- 保持组件文件 200-400 行（可拆多个文件）。
完成后返回一段文字：你创建的文件路径 + 默认导出组件名 + 用了哪些 store actions。

注意：不要运行 build（Integrate 阶段统一跑）。不要修改 apps/web/src/app/page.tsx 或 layout.tsx 或 globals.css 或 stores/ 或 lib/（那些属于 Foundation/Integrate）。
`;

const SWIPE_PROMPT = FEATURE_TEMPLATE(
  'swipe',
  '包含：BlindCard（卡片艺术 SVG + headline/desc/tags/scene，art 用 index.html 的 artSVG 三种风格 mist/leaf/amber）、SwipeDeck（三张叠卡 behind/behind2 + 顶部卡拖拽手势 + 想喝/下一杯按钮 + 顶部计数器与 ? 帮助气泡）、RevealSheet（喜欢后 bottom sheet：茶名/产区/专业标签/翻译 + 继续刷/看看这杯）、TasteSummary（5 次后「我开始有点懂你了」summary sheet）。',
  'features/swipe/SwipeScreen.tsx（默认导出，含 BlindCard/SwipeDeck/RevealSheet/TasteSummary，可拆多个文件：features/swipe/BlindCard.tsx、SwipeDeck.tsx、RevealSheet.tsx、TasteSummary.tsx）',
  '参考 index.html 的 Screen 2 Blind Swipe、Screen 3 卡片B/C、Screen 4 Reveal、Screen 5 Taste Summary、以及 <script> 里的 renderSwipe/artSVG/cardHTML/bindDrag/swipe/openReveal/closeReveal/openSummary/closeSummary/maybeSummary 方法。'
);

const DETAIL_PROMPT = FEATURE_TEMPLATE(
  'tea-detail',
  '包含：茶详情首屏（茶名/产区/感官标签/极简茶叶视觉）+ 三个大动作卡（泡这杯/品这杯/看看它从哪里来）+ 下方 meta（感官/冲泡/地域/工艺）。从 store.currentTea 读当前茶。三个动作卡分别跳转 store.go(\'brew\'/\'taste\'/\'realm\')。',
  'features/tea-detail/DetailScreen.tsx（默认导出）',
  '参考 index.html 的 Screen 6 Tea Detail 与 openDetail 方法。'
);

const BREW_PROMPT = FEATURE_TEMPLATE(
  'brew',
  '包含：深色沉浸页。顶部标题(当前茶名+泡茶陪伴)+麦克风图标；摄像头 preview mock(盖碗 SVG + 检测到：盖碗/当前步骤标签)；步骤进度条(投茶→注水→等待→出汤→完成，高亮当前)；AI companion 卡片(当前话术 + 「为什么?」可展开)；底部「结束这一泡/下一步」。步骤话术复刻 index.html 的 renderBrew 的 steps/says/whys/stateTxt 四组数组。',
  'features/brew/BrewScreen.tsx（默认导出）',
  '参考 index.html 的 Screen 7 Brew Mode 与 enterBrew/brewNext/renderBrew 方法。'
);

const TASTE_PROMPT = FEATURE_TEMPLATE(
  'taste',
  '包含：顶部「喝一口。不用说专业词。」+「它让你想到什么?」；中央大麦克风按钮(点击后显示语音气泡示例「有点像青草，但没那么冲，喝完还有一点甜。」+ AI 翻译气泡「我大概懂你的意思…清鲜/嫩香/回甘」)；下方「这杯你喜欢吗?」三个按钮(比想象中喜欢/还行/不是我的菜)，点击后「记住了。下一杯会更懂你一点。」并调 store.tasteRate(标记 markTasted)。',
  'features/taste/TasteScreen.tsx（默认导出）',
  '参考 index.html 的 Screen 8 Taste Mode 与 resetTaste/tasteSpeak/tasteRate/markTasted 方法。'
);

const REALM_PROMPT = FEATURE_TEMPLATE(
  'tea-realm',
  '包含三个 screen：RealmScreen(首页：标题「喝过的茶，会慢慢长成你的世界。」+ 2.5D 像素茶山 SVG + 已解锁都匀毛尖卡「进入一叶成茶」+ 未解锁 ??? 提示)、ChapterScreen(一叶成茶四阶段：生长/采摘/制茶/人与故事，含章节 SVG 场景、点击推进、进度点、对话卡、底部按钮，文案复刻 index.html chapterData)、EndingScreen(像素叶落下 →「这就是你刚刚喝的那杯茶。」→「收进茶护照」)。',
  'features/tea-realm/RealmScreen.tsx、ChapterScreen.tsx、EndingScreen.tsx（各默认导出）',
  '参考 index.html 的 Screen 10/11/12 与 renderRealm/realmSVG/startChapter/chapterData/renderChapter/chapterSceneSVG/chapterNext/addPassport 方法。SVG 用 index.html 里已画好的 path/rect 原样复用。'
);

const PASSPORT_BTI_PROMPT = FEATURE_TEMPLATE(
  'passport + teabti + profile',
  '包含三个 screen：ProfileScreen(「我的茶」头部 + Tea-BTI 卡 + 茶护照 mini 列表 + 收藏空态)、TeaBtiScreen(「你的 Tea-BTI」+ 春雾回甘型 persona 卡 + 四轴可视化(轻盈/饱满24、清鲜/温熟18、甜润/劲爽32、干净/绵长71)+ motto「不是测出来的，是喝出来的。」+ evidence + 两个 CTA)、PassportScreen(茶护照收藏册，读取 store.passport 渲染已收录茶 + 印章 + 你说引用语)。',
  'features/passport/PassportScreen.tsx、features/teabti/TeaBtiScreen.tsx、features/profile/ProfileScreen.tsx（各默认导出）',
  '参考 index.html 的 Screen 13/14/15 与 renderBtiAxes/renderPassport/renderProfile/passportMini/addPassport 方法。'
);

const INTEGRATE_PROMPT = `${CTX}

你的职责（Phase 3 · Integrate）：把 Foundation + 所有 feature 组件串成可运行的完整 App，并验证 build。

先读以下文件了解全部契约（绝对路径）：
- apps/web/src/stores/app-store.ts
- apps/web/src/lib/types.ts、lib/teas.ts
- apps/web/src/components/*.tsx（BottomNav/FloatingCompanion/DesktopSidebar/LaunchScreen/ui）
- apps/web/src/features/**/*.tsx（swipe/detail/brew/taste/realm/passport/teabti/profile 各默认导出组件）
- apps/web/src/app/page.tsx（当前是占位框架）

然后：
1) 重写 apps/web/src/app/page.tsx（"use client"）：从 useAppStore 读 currentScreen，用完整 switch 渲染 11 个 screen：
   launch→LaunchScreen, swipe→SwipeScreen, detail→DetailScreen, brew→BrewScreen, taste→TasteScreen, realm→RealmScreen, chapter→ChapterScreen, ending→EndingScreen, profile→ProfileScreen, teabti→TeaBtiScreen, passport→PassportScreen。
   挂载 <BottomNav/>（currentScreen 为 launch/brew/taste 时隐藏）、<FloatingCompanion/>（launch/brew/taste 隐藏）。RevealSheet/TasteSummary/CompanionDrawer 若已在各 feature 内作为覆盖层自渲染，则无需额外处理；否则在此统一挂载并读 store 的 revealTea/showSummary/showCompanion。
   确保桌面三栏由 layout.tsx 的 .stage 实现，page 只渲染中栏 App 内容。

2) 运行 cd apps/web && npm run build。若失败，逐条修复类型/编译错误（不改变视觉与文案，只修编译问题），再次 build，循环直到通过。

3) 若 build 通过，再运行 cd apps/web && npx next dev 不实际启动，仅确认无配置错误（可选）。至少保证 build 通过。

完成后返回结构化文字报告：
- build 是否通过
- 修复过的错误清单（若有）
- 最终 page.tsx 的路由映射
- 剩余风险或 TODO
`;

phase('Foundation');
const foundation = await agent(FOUNDATION_PROMPT, { label: 'foundation', schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, storeApi: { type: 'string' }, cssClasses: { type: 'string' }, tscResult: { type: 'string' } }, required: ['files', 'storeApi', 'cssClasses', 'tscResult'] } });
log('Foundation done: ' + (foundation ? (foundation.files || []).length + ' files' : 'null'));

phase('Features');
const featureResults = await parallel([
  () => agent(SWIPE_PROMPT, { label: 'feature-swipe' }),
  () => agent(DETAIL_PROMPT, { label: 'feature-detail' }),
  () => agent(BREW_PROMPT, { label: 'feature-brew' }),
  () => agent(TASTE_PROMPT, { label: 'feature-taste' }),
  () => agent(REALM_PROMPT, { label: 'feature-realm' }),
  () => agent(PASSPORT_BTI_PROMPT, { label: 'feature-passport-bti' }),
]);
log('Features done: ' + featureResults.filter(Boolean).length + '/6');

phase('Integrate');
const integrate = await agent(INTEGRATE_PROMPT, { label: 'integrate-verify', schema: { type: 'object', properties: { buildPassed: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } }, routeMap: { type: 'string' }, risks: { type: 'string' } }, required: ['buildPassed'] } });

return {
  foundation,
  features: featureResults.filter(Boolean).length,
  integrate,
};
