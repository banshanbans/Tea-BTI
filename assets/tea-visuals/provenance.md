# Tea-BTI 视觉资产来源说明

> 资产状态：Hackathon Demo  
> 生成方式：OpenAI 内置 ImageGen  
> 真实性状态：`synthetic_demo`  
> 权利状态：`demo_only`

## 使用边界

本目录中的首批茶视觉基底是为交互原型生成的合成示意图，不是具体商品、批次、茶园或产地的纪实摄影，也不构成官方感官鉴定。

- 不应用于证明茶叶外形、等级、品质或产地；
- 不应在生产环境中继续标记为真实摄影；
- 产品化前应逐项替换为自摄或已获得明确授权的真实素材；
- 替换素材仍须通过 Blind 泄露、资料可追溯与使用权检查；
- 页面中的结构色、抽象形与环境暗示由代码层渲染，不写入基底图。

## Tea Realm《雾里一芽》

茶境资产严格分为两层：

- 雾层、风格化山体、工坊背景和“白毫”数字标本卡由 OpenAI 内置 ImageGen 生成，只承担氛围与交互表达；
- 真实干茶 Reveal 来自 Xia, W.-W. et al. (2026), *Different grades of Duyun Maojian tea...*, *Food Chemistry: X* 35, 103843, Figure 7A，DOI: https://doi.org/10.1016/j.fochx.2026.103843。论文按 CC BY 4.0 发布，项目只裁剪了 Figure 7A 的五级干茶对照行。

界面会明确说明该照片是“论文样本，不代表商品批次”。Demo 可依许可使用，但正式商业发布前仍必须替换为品牌自有或明确商用授权摄影。`53,000+` 是 `evidenceStatus: debt` 的 Demo 记忆点，公开发布前必须补齐来源。

## 茶品资料依据

### 都匀毛尖

- 来源：DB52/T 433—2018 都匀毛尖茶省级地方标准
- 链接：https://nynct.guizhou.gov.cn/xwzx/wjzz/201810/t20181023_25593500.html
- 使用范围：嫩香/栗香、鲜爽回甘、嫩黄绿明亮汤色。

### 湄潭翠芽

- 来源：贵州省农业农村厅《湄潭翠芽》
- 链接：https://nynct.guizhou.gov.cn/syqt/tsny/202512/t20251202_89008101.html
- 使用范围：清香/嫩香/栗香持久、鲜爽、嫩绿明亮汤色。

### 遵义红

- 来源：贵州省国资委公开产品品质说明
- 链接：https://gzw.guizhou.gov.cn/xwzx/qyzc/202105/t20210511_68054280.html
- 使用范围：红亮汤色、甜香高且持久、鲜爽醇厚。

## 视觉研究边界

项目未安装、复制或调用 Gathered Scenes Zine 与 Photo Abstract Editorial 的 Skill、Prompt 或工作流。Tea Visual Grammar 只吸收一般设计原则，并由项目文档独立定义。

## 文件关系

- `masters/`：内置 ImageGen 的项目归档 PNG；
- `media/`：确定性导出的 WebP；
- `thumbnails/`：Passport 使用的确定性缩略图；
- `previews/`：HTML/CSS 评审页的 390×844 状态截图；
- `manifest.json`：Visual Profile、素材、裁切、权利和校验哈希；
- `prompts.json`：每个生成资产的最终 Prompt。
