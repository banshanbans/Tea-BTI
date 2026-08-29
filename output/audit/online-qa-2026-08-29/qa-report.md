# 线上移动端 QA 与修复记录

日期：2026-08-29  
环境：`https://gks.socialdog.cn`，390 × 844 移动端视口

## 结论

- 点击偶发无响应的主因不是成都网络，而是公网 Web 运行在 Next.js 开发模式。修复前服务器日志出现单路由 7–13 秒编译、23.5 秒首页编译和内存阈值重启。
- 公网已切换为 Next.js production standalone 镜像。服务器侧页面首字节约 40–81 ms；Web 容器内存由约 1.32 GiB 降至约 43 MiB；详情跳转实测约 296 ms。
- Web 日志只保留启动与 Ready 信息，不再出现按页面 Compiling。

## 已修复项目

1. 三杯破冰卡支持左右手势切换，左右按钮保留为无障碍与备用入口。
2. MBTI 改为纵向闹钟式滚轮；当前项居中放大，说明文案、序号和确认按钮随选择联动。
3. 揭晓弹层的“继续刷”和“看看这杯”使用等宽、等高布局。
4. 茶详情反馈按钮增加间距并禁止标签换行。
5. “不对味”统一改为“不对胃”。
6. 茶详情页移除 Tea-BTI 顶部栏，保留底部主导航。

## 验证

- Web 单元与组件测试：9 个测试文件、21 条测试全部通过。
- Next.js production build：通过。
- Docker Compose production 合并配置：通过。
- 公网健康检查：`/healthz` 返回 200；首页、茶详情、茶境、护照均返回 200。
- 公网能力仍为 `voice: mock`，与当前未配置真实火山引擎密钥的状态一致。

## 截图证据

- 修复前：`01-mbti-before.png` 至 `06-tea-detail-full-before.png`
- 修复后：`11-public-mbti-after.png`、`12-public-tea-detail-after.png`、`13-public-reveal-after.png`
