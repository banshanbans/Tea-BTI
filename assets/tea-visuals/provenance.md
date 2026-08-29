# Tea-BTI 视觉资产来源与编辑说明

> 资产状态：Hackathon 非商业 Demo
> 清单版本：`schema_version: 3`
> 运行时事实来源：`assets/tea-visuals/manifest.json`

## 两套活动主素材

八款茶各有两套相互独立的主素材，共 16 个活动资产：

- `presentation`：用户提供的完整立体化贵州茶设计图，用于 MBTI、刷茶、揭晓、推荐、护照和个人主页。运行时按原始约 9:16 构图完整显示，不裁掉图内茶名；权利状态统一为 `demo_only`。
- `detail`：用户提供的八款茶真实照片，只用于茶叶详情。来源页逐张登记，权利状态统一为 `unknown`，仅限非商业演示与设计参考。

原件保存在 `masters/`，运行时 WebP 保存在 `media/`。清单逐项记录来源 URL、原件与输出尺寸、原件/编辑母版/WebP 哈希、对象位置、权利状态和编辑链。旧的三款卡片基底保留在 `legacy_assets` 且 `active: false`，不进入当前 Feed。

## 两张精确去水印图

只处理了用户指定的两个右下角水印，未覆盖原件：

| 茶 | 原件 | 版本化输出 | 编辑范围 | 验证 |
|---|---|---|---|---|
| 湄潭翠芽 | `masters/detail/source/meitan-cuiya.png` | `masters/detail/edited/meitan-cuiya-watermark-removed-v1.png` | `210×84+870+740` | 保持 1080×824；范围外像素差 `0 (0)` |
| 梵净山抹茶 | `masters/detail/source/fanjingshan-matcha.jpg` | `masters/detail/edited/fanjingshan-matcha-watermark-removed-v1.png` | `480×88+720+560` | 保持 1200×648；范围外像素差 `0 (0)` |

编辑流程为：OpenAI ImageGen（image-2）只生成水印区域的修复内容，再把该矩形区域合成回原分辨率原图。没有调整茶叶、茶汤、器皿、背景、色彩或构图。凤冈锌硒茶和遵义红画面中的说明文字按要求保留。

去除水印不改变照片版权状态，也不代表取得公开发布或商业使用授权。正式发布前必须向原作者或平台确认许可，并优先替换为自摄或明确商用授权照片。

## 八张实拍图来源页

1. 都匀毛尖：https://www.pp918.com/guideinfo_9521.html
2. 湄潭翠芽：https://nynct.guizhou.gov.cn/syqt/tsny/202512/t20251202_89008101.html
3. 绿宝石茶：https://www.chabaike.com/lvcha/lvbaoshicha/
4. 普安红：https://www.tesegu.com/techan/54874.html
5. 凤冈锌硒茶：https://www.chinateawholesale.com/product-page/fenggang-zinc-selenium-organic-tea-gui-zhou-green-tea-wholesale-1
6. 遵义红：https://www.ebuy7.com/2023-guizhou-zunyi-black-tea-meitan-fenggang-alpine-cloud-tea-bulk-bag-fruity-flavor-bulk-250g.html
7. 雷山银球茶：https://www.nfncb.cn/yaowen/45539.html
8. 梵净山抹茶：https://www.thepaper.cn/newsDetail_forward_25908717

上述列表来自用户附带的 `图片来源说明.md`，它只说明素材取得位置，不等同于授权凭证。

## 茶品事实依据

详情事实与图片来源分开登记。当前目录以农业农村部门、地方标准、产区政府及知识产权公开资料作为事实依据：

- 都匀毛尖：农业农村部介绍、DB52/T 433—2018；
- 湄潭翠芽：贵州省农业农村厅、国家知识产权局地理标志资料；
- 绿宝石茶：贵州颗粒形绿茶地方标准与标准公告；
- 普安红：贵州兴农网产区资料；
- 凤冈锌硒茶：贵州省农业农村厅与地理标志公开资料；
- 遵义红：贵州省农业农村厅与地方标准；
- 雷山银球茶：铜仁市政府公开资料；
- 梵净山抹茶：铜仁市政府公开资料。

每条页面展示的完整链接位于 `apps/api/data/tea-catalog.json` 的 `evidenceRefs`。冲泡参数统一标记为体验建议，不作为等级、品牌或检测结论。

## Tea Realm《雾里一芽》

都匀毛尖茶境保持原有边界：雾层、风格化山体、工坊背景和“白毫”数字标本为 ImageGen 生成的氛围素材；真实干茶 Reveal 来自 Xia, W.-W. et al. (2026), *Food Chemistry: X* 35, 103843, Figure 7A（CC BY 4.0）。界面明确说明它是论文样本，不代表商品批次。

其他七款本次只接入八茶目录、Swipe、详情及共用产品页面，不新增 Tea Realm。

## 文件关系

- `masters/presentation/`：八张立体设计图原件副本；
- `masters/detail/source/`：八张实拍原件与用户附带来源说明；
- `masters/detail/edited/`：两张版本化精确去水印母版；
- `media/presentation/`、`media/detail/`：确定性导出的活动 WebP；
- `manifest.json`：资产、尺寸、哈希、来源、权利、编辑链与历史状态；
- `manifest.schema.json`：清单结构约束。
