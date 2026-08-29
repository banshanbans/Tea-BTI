# Google Stitch 前端生成 Prompt｜Tea-BTI

请为我设计并生成一套 **移动端优先（Mobile-first）的高完成度 Web App 前端原型**。

项目名称：

# Tea-BTI

产品一句话：

> **一个年轻人第一次进入原叶茶世界的发现界面。**

核心 Slogan：

> **你不用先懂茶。刷几下，茶先开始懂你。**

长期体验：

> **Discover → Brew → Taste → Explore → Remember → Evolve**

---

# 1. 你要设计的不是传统茶叶 App

请不要做成：

- 中国风茶商城；
- 电商商品列表；
- 茶文化百科；
- 古典卷轴 UI；
- “AI 茶艺师”大聊天框首页；
- 复杂 Dashboard；
- MBTI 测试页面；
- 问卷 onboarding；
- 传统老年茶馆审美。

它应该更接近：

> **年轻消费产品 + Swipe Discovery + AI Companion + 轻游戏化收藏**

关键词：

- 年轻；
- 克制；
- 清爽；
- 有一点实验感；
- 有一点编辑设计感；
- 有贵州自然气息；
- 局部使用 2.5D / pixel-art 元素；
- 不是俗套“国潮”。

---

# 2. 视觉方向

## 整体风格

希望是：

> **现代 editorial UI × 自然茶色 × 柔和像素世界**

建议：

- 大面积暖白 / 米白背景；
- 深墨绿作为主要文字；
- 嫩叶绿作为局部互动强调；
- 茶汤琥珀色作为辅助；
- 很少使用大红大金；
- 卡片圆角适中；
- 很多留白；
- 字体层级清晰；
- 动效轻、快、自然；
- 不要过度玻璃拟态；
- 不要赛博朋克。

### 视觉情绪

首页：

> 像一个年轻的内容 App。

Tea Realm：

> 像一个轻量、治愈的 2.5D 像素农场世界。

Tea Passport：

> 像一本个人旅行护照 / 收藏册。

Tea-BTI：

> 像 Spotify Wrapped / 年度人格卡，但更安静。

## Tea Visual Grammar｜必须执行

Tea-BTI 的视觉不是统一海报滤镜，而是风味翻译系统。

Blind Card 默认采用：

> **65–75% 真实茶的视觉权重 + 25–35% 情绪转译**

每张卡必须包含一个真实茶锚点：

- 茶汤；
- 杯沿 / 蒸汽；
- 注水动作；
- 经过 Blind-safe 裁切的叶底或干茶局部。

每张卡的情绪转译只能使用：

1. 一个结构色；
2. 一个抽象形；
3. 一个环境暗示。

不要给所有卡重复使用撕纸、复古颗粒、打字机小字或同一种拼贴版式。连续三张卡必须能靠构图、真实锚点和主形态区分，而不只是换颜色。

Blind 状态禁止出现：

- 包装与 Logo；
- 产地文字与地标；
- 完整商品摄影；
- 足以直接暴露茶类或茶名的典型干茶形态；
- 无来源的花朵、水果、栗子或文化符号。

Reveal、详情和 Tea Realm 必须延续同一款茶的结构色、抽象形和环境气氛，只逐步增加真实身份信息。

不要直接模仿或复刻任何外部 Visual Skill 的标志性成品版式。完整规则参考项目内 `docs/design/tea-visual-grammar.md`。

---

# 3. 产品信息架构

底部只设置三个一级 Tab：

1. **刷茶**
2. **茶境**
3. **我的**

另外：

- “泡这杯”
- “品这杯”

属于茶详情页内部动作。

AI 茶伴：

> 作为右下角 Floating Companion 出现，不是一级 Tab。

---

# 4. 请生成以下完整页面 / 状态

---

## Screen 1｜Launch / Entry

不要登录。

不要注册。

不要问卷。

页面只有：

### Logo

刷茶

### 主文案

> **你不用先懂茶。**
> **刷几下，茶先开始懂你。**

辅助：

> 今天想喝什么？别选，刷就行。

按钮：

> `开始刷茶`

下方极轻提示：

> 不需要做测试。

不要出现 MBTI。

---

# 5. Screen 2｜Blind Swipe 首页

这是整个产品最重要的页面。

请把卡片做成全屏偏上的大型 Swipe Card。

### 卡片第一态不能显示：

- 茶名；
- 品牌；
- 价格；
- 茶类；
- 等级。

### 示例卡片 A

Headline：

> **清一点。**

Body：

> 像刚冒出来的嫩叶，  
> 尾巴还会留一点甜。

Tags：

`轻盈`
`清鲜`
`回甘`

Scene：

> “适合刚睡醒的周末上午”

视觉：

- 真实锚点：暖白杯中的浅色茶汤、杯沿与极轻蒸汽；
- 结构色：嫩黄绿，只使用一个强调色；
- 抽象形：一条细长山脊线，从茶汤边缘向留白延伸；
- 环境暗示：清晨薄雾；
- 保留大量暖白留白；
- 不出现包装、茶名、产地地标和完整干茶形态；
- 看起来是年轻内容产品，不是商品海报。

底部按钮：

左：

> `下一杯`

右：

> `想喝`

不要出现传统 Tinder 的红心 / X 强烈色彩。

可以使用：

- 左右滑动；
- 点击按钮。

顶部：

> 2 / 6

右上：

一个很小的：

> `？`

用于说明：

> “现在不会告诉你茶名，先选感觉。”

---

# 6. Screen 3｜Blind Swipe 卡片 B / C

请至少设计三种风格明显不同的 Blind Card，便于 Demo。

### B

> **甜香先到。**
>
> 有味道，但不厚重。  
> 下午想喝点东西的时候刚好。

Tags：

`甜香`
`鲜爽`
`柔和`

视觉：

- 真实锚点：注水动作或叶底局部；
- 结构色：春绿；
- 抽象形：少量层叠横线；
- 环境暗示：春日下午；
- 不使用与卡片 A 相同的山脊构图。

---

### C

> **这一杯更有存在感。**
>
> 稍微厚一点，  
> 尾韵会停得久一点。

Tags：

`醇厚`
`温熟`
`绵长`

视觉：

- 真实锚点：琥珀色茶汤；
- 结构色：暖红褐；
- 抽象形：一个圆润、低重心的色块；
- 环境暗示：傍晚木桌；
- 构图更沉稳，但不要变成传统红茶商品广告。

---

# 7. Screen 4｜Reveal Moment

当用户点击“想喝”以后，

卡片不要立即消失。

做一个 Reveal 动画：

Blind 文案淡出一部分。

Tea Identity 从下方出现。

示例：

> **你刚刚喜欢的是：**

# 都匀毛尖

`贵州 · 黔南`

专业标签：

`绿茶`
`栗香`
`鲜爽`
`回甘`

接着显示一句翻译：

> 你刚刚说的“清、嫩、尾巴有点甜”，  
> 在茶的语言里，大概就是这一挂。

CTA：

> `继续刷`

Secondary：

> `看看这杯`

---

# 8. Screen 5｜“我开始有点懂你了”

在完成 5 次 Swipe 后出现。

不是完整页面弹窗感，

更像一张“AI quietly understood you”的 Summary Card。

标题：

> **我开始有点懂你了。**

正文：

> 你连续留下了  
> **清 / 鲜 / 有一点甜**
>
> 但两次跳过了  
> **浓 / 厚 / 尾韵特别重**

推荐：

# 都匀毛尖

Label：

> **目前最想让你试的一杯**

不要显示：

> 92% 匹配率。

CTA：

> `喝这杯 →`

Secondary：

> `再刷几杯`

视觉上这是第一个“小高潮”。

---

# 9. Screen 6｜Tea Detail

示例茶：

# 都匀毛尖

顶部：

- 茶名；
- 贵州 · 黔南；
- 极简茶叶视觉；
- `鲜爽 · 栗香 · 回甘`

视觉连续性：

- 继承 Blind Card 的嫩黄绿、细长山脊和清晨薄雾；
- 真实锚点从茶汤局部扩展到完整茶叶 / 茶汤视觉；
- 不突然切换到另一套商品摄影或国风版式；
- 产地内容可采用“真实产地摄影 + 抽象记忆面板”，但抽象部分只能来自该照片真实存在的空间、颜色和结构。

不要做传统商品详情。

首屏重点只出现三个大动作：

### Primary

🫖

> **泡这杯**

辅助：

> AI 在旁边看着你泡。

### Primary

🍵

> **品这杯**

辅助：

> 不会形容也没关系。

### Secondary

🌱

> **看看它从哪里来**

辅助：

> 进入这片叶子背后的贵州。

下面才是：

- 冲泡建议；
- 官方感官描述；
- 地域；
- 制作工艺；
- 我的记录。

右下角一直有：

> AI 茶伴 Floating Button

---

# 10. Screen 7｜Brew Mode

做成沉浸但仍然简洁的页面。

顶部：

> 都匀毛尖 · 泡茶陪伴

主体：

一个 Camera Preview 区域。

不需要真正调用摄像头，只设计 UI。

画面上可显示轻量视觉识别标记：

> `检测到：盖碗`

> `当前：正在注水`

不要像 CV Debug Dashboard。

底部 AI Companion 卡片：

AI：

> “差不多可以出汤了。”

下面一个小的：

> `为什么？`

点击后可展开：

> “这一泡建议短一些，能让鲜爽感更明显。”

底部状态进度：

`投茶 → 注水 → 等待 → 出汤 → 完成`

当前步骤高亮。

操作：

> `结束这一泡`

右上：

> 麦克风状态

AI Voice Visualizer 可以很轻。

---

# 11. Screen 8｜Taste Mode

顶部：

> **喝一口。**
>
> 不用说专业词。

中心：

一个大型语音输入区域。

Prompt：

> “它让你想到什么？”

用户示例 Speech Bubble：

> “有点像青草，  
> 但没那么冲，喝完还有一点甜。”

AI 回答：

> **我大概懂你的意思。**
>
> 你说的前半段接近：
> `清鲜`
> `嫩香`
>
> 后面的甜感：
> `回甘`

下面：

> **这杯你喜欢吗？**

三个大按钮：

> `比想象中喜欢`

> `还行`

> `不是我的菜`

点击以后：

显示：

> “记住了。下一杯会更懂你一点。”

---

# 12. Screen 9｜AI 茶伴 Drawer / Chat

从右下角 Floating Button 打开 Bottom Sheet / Drawer。

不要独立成 ChatGPT 页面。

Header：

> **茶伴**

Context：

> 正在聊：都匀毛尖

快捷问题：

- `下一泡怎么调整？`
- `我上次怎么形容它？`
- `为什么会有栗香？`

Conversation：

用户：

> “我第二泡是不是泡久了？”

AI：

> “比第一泡稍微久一点没关系。你刚刚说第二泡更甜，可以继续保持这个节奏。”

历史入口：

> `查看这杯茶的历史记录`

---

# 13. Screen 10｜Tea Realm 首页

Tab：

> 茶境

不要做文章 Feed。

顶部：

> **喝过的茶，会慢慢长成你的世界。**

展示一个 2.5D 像素贵州茶山世界。

请设计成：

- 等距 / 2.5D；
- 像素 / pixel-art；
- 山地；
- 雾；
- 茶园；
- 小屋；
- 制茶工坊；
- 人物。

Tea Realm 不是独立随机风格。都匀毛尖区域继续使用其嫩黄绿结构色、细长山脊与薄雾气氛，并把它们转译成像素地形、路径和环境层。

已解锁：

> 都匀毛尖

未解锁：

> `???`

用户点击都匀毛尖：

> `进入一叶成茶`

---

# 14. Screen 11｜Tea Realm / 一叶成茶

这不是完整农场经营游戏。

而是一个 30–60 秒轻互动章节。

页面建议分成场景状态。

### Stage 1

> **让它长出来。**

视觉：

像素茶山。

任务：

> 点击云雾 / 茶芽。

完成后：

> “贵州山地与多雾环境，让茶树在这里形成自己的生长节奏。”

按钮：

> `继续`

---

### Stage 2

> **摘下这一芽。**

视觉：

茶树嫩芽。

任务：

点击适合的芽。

反馈：

> “你刚刚采下的是一芽一叶。”

---

### Stage 3

> **让它成为茶。**

视觉：

像素制茶锅。

用户：

拖动 / 点击进行轻量翻炒。

进度：

`杀青`

完成：

> “这一道工序改变了叶子的香气与状态。”

---

### Stage 4

茶农 / 制茶师小角色出现。

对白不要超过 2–3 句。

示例：

> “我第一次守这口锅的时候，也把茶炒焦过。”

> “后来才明白，每一锅都有自己的脾气。”

---

# 15. Screen 12｜Tea Realm Ending

把像素茶叶从工坊带回现实。

视觉：

像素叶子落下。

逐渐变成现实 Tea Card。

文案：

> **这就是你刚刚喝的那杯茶。**

# 都匀毛尖

CTA：

> `收进茶护照`

这是整个故事的重要情绪高潮。

---

# 16. Screen 13｜我的

顶部不做账户信息。

Header：

> **我的茶**

主要两个模块：

### Tea-BTI

大型人格卡。

### Tea Passport

喝过的茶。

下面：

- 收藏；
- 最近品饮；
- 历史记录。

---

# 17. Screen 14｜Tea-BTI

不要设计成 MBTI 测试结果。

Header：

> **你的 Tea-BTI**

状态：

> `正在形成`

或：

> `逐渐稳定`

人格：

# 🌫️ 春雾回甘型

描述：

> 你更容易被轻盈、清鲜的茶吸引。  
> 喜欢入口柔和一点，  
> 但尾巴最好留久一点。

四轴可视化：

### 轻盈 — 饱满

偏轻盈

### 清鲜 — 温熟

偏清鲜

### 甜润 — 劲爽

略偏甜润

### 干净 — 绵长

偏绵长

下方：

> **不是测出来的，是喝出来的。**

Evidence：

> 最近让这个画像更清晰的是：

❤️ 都匀毛尖  
❤️ 湄潭翠芽  
→ 跳过某款浓厚型茶

CTA：

> `继续刷，让它更懂你`

Secondary：

> `分享我的 Tea-BTI`

---

# 18. Screen 15｜Tea Passport

做成一本现代数字护照 / 收藏册。

标题：

> **茶护照**

Subtitle：

> 你真正喝过的茶，才算来过这里。

Grid / List：

### 都匀毛尖

`贵州 · 黔南`

Badges：

`已泡`
`已品`
`已解锁茶境`

用户自己的话：

> “像雨后的嫩草，第二泡更甜。”

---

### 遵义红

`贵州 · 遵义`

Badges：

`已品`

用户：

> “甜香比我想象的明显。”

---

# 19. 导航

底部 Navigation：

### 刷茶

icon：cards / swipe

### 茶境

icon：leaf / landscape

### 我的

icon：passport / user

选中状态简洁。

---

# 20. 核心交互

请确保原型包含：

1. Swipe Card；
2. 点击“想喝”；
3. Reveal 动画状态；
4. 完成多次 Swipe 后出现 Taste Summary；
5. Tea Detail；
6. Brew Mode；
7. Taste Mode；
8. AI Companion Drawer；
9. Tea Realm；
10. Tea Passport；
11. Tea-BTI 。

---

# 21. Demo 数据

请使用这些示例名：

- 都匀毛尖
- 遵义红
- 湄潭翠芽
- 普安红
- 雷山银球茶

但前端不用一次全部展示。

核心 Demo Tea：

> **都匀毛尖**

---

# 22. Mock Data 要求

请直接在前端写 Mock Data。

不要依赖后端。

示例：

```ts
type Tea = {
  id: string
  name: string
  region: string
  blindHeadline: string
  blindBody: string
  blindTags: string[]
  professionalTags: string[]
  visualProfile: {
    primaryAnchorAssetId: string
    anchorTypes: Array<"tea_liquor" | "infusion" | "wet_leaf" | "dry_leaf" | "brewing_action">
    structureColor: string
    structureColorBasis: string
    abstractForm: string
    abstractFormBasis: string
    atmosphereCue: string
    atmosphereIsMetaphor: boolean
    overlay: {
      bottomPercent: number
      leftPercent: number
      widthPercent: number
      heightPercent: number
      opacity: number
      atmosphereOpacity: number
    }
  }
  visualAssets: Array<{
    id: string
    sourceKind: "ai_generated" | "self_shot" | "licensed_photo"
    authenticityState: "synthetic_demo" | "documentary"
    rightsState: "owned" | "licensed" | "demo_only" | "unknown"
    mediaPath: string
    cropStrategy: string
    blindSafe: boolean
    identityRisk: "low" | "medium" | "high"
    promptId: string
    sha256: string
  }>
}
```

首批原型直接读取项目内 `assets/tea-visuals/manifest.json`，不要在页面代码里重复维护 Visual Profile。

所有页面都应该有真实内容，

不要大量使用：

> Lorem ipsum

或：

> Tea Name

等占位文案。

---

# 23. 响应式要求

优先目标：

- iPhone 15 Pro / 16 Pro 尺寸；
- 微信内置浏览器；
- Safari；
- Android 手机。

桌面打开时：

不要把移动 UI 无限拉宽。

使用：

> centered mobile experience / max-width layout

但不要设计成手机 Mockup 套壳。

---

# 24. 动效

需要重点设计：

### Swipe

- 手势跟随；
- 卡片轻旋转；
- 松手回弹；
- 完成滑动进入下一张。

### Reveal

- Blind 内容退场；
- 茶名渐现；
- 标签出现。

### Taste Summary

- 不要弹窗震动；
- 像产品“突然理解你”。

### Tea-BTI

轴线缓慢出现。

### Tea Realm

轻像素动画。

不要：

- 大量炫技；
- 粒子爆炸；
- 霓虹效果。

---

# 25. 设计原则

## Principle 1

> **Zero onboarding**

第一分钟不要让用户填东西。

## Principle 2

> **先感觉，后术语**

Blind Card 先用普通人语言。

Reveal 后再展示专业茶语。

## Principle 3

> **AI should feel ambient**

AI 不应该占满产品。

它只在需要时出现。

## Principle 4

> **Culture should be experienced**

文化用 Tea Realm，而不是文章列表。

## Principle 5

> **Tea-BTI is earned, not tested**

不要出现：

> “开始 Tea-BTI 测试”。

---

# 26. 最重要的 UX Story

整个前端必须让第一次体验形成这条路径：

```text
开始刷茶
↓
Blind Swipe
↓
喜欢某种感觉
↓
Reveal 原来是什么茶
↓
AI 开始理解 Taste
↓
推荐一杯
↓
泡这杯
↓
AI 视觉 / 语音陪伴
↓
品这杯
↓
普通语言被翻译成茶语言
↓
进入 2.5D 茶境
↓
理解一片叶子背后的贵州
↓
加入茶护照
↓
Tea-BTI 更新
↓
继续刷
```

---

# 27. 最后请输出

请生成：

1. 完整移动端 UI；
2. 所有主要页面；
3. 可点击的页面导航；
4. Swipe interaction；
5. Reveal state；
6. AI Companion drawer；
7. Brew / Taste mock state；
8. Tea Realm 2.5D pixel-inspired screen；
9. Tea Passport；
10. Tea-BTI；
11. Mock Data；
12. 完整中文 UI 文案；
13. 3 款核心茶的 Visual Profile；
14. Blind → Reveal → 详情 → Tea Realm 的视觉继承；
15. 可替换的本地 Mock 视觉资产槽位，不依赖外部 Skill 或在线生图。

优先级：

> **产品完整感 > 页面数量 > 视觉炫技**

最终效果应该让评委一打开就理解：

> **这不是一个“推荐茶叶的 AI 工具”。**
>
> **这是一个让年轻人从第一杯开始进入原叶茶世界的新界面。**
