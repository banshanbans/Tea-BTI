# Tea-BTI 黑客松快速上线规范

本文档是 Tea-BTI 路演环境的固定上线流程。目标是用最少步骤得到可演示、可验证、可快速回退的版本；它不是严格生产环境方案。

## 1. 固定约定

| 项目 | 固定值 |
|---|---|
| 服务器 | `1.14.75.189` |
| 正式入口 | `https://gks.socialdog.cn` |
| SSH 用户 | `ubuntu` |
| 本地私钥 | 项目根目录 `Hackathon.pem` |
| SSH 命令 | `ssh -i ./Hackathon.pem ubuntu@1.14.75.189` |
| 远端目录 | `/opt/tea-bti` |
| 部署分支 | `main` |
| Git 仓库 | `https://github.com/banshanbans/Tea-BTI.git` |
| 前端容器端口 | `3000` |
| API 容器端口 | `8000` |
| 数据 | SQLite，保存在远端 `/opt/tea-bti/.data` |
| HTTPS 网关 | 服务器现有 `anju-caddy-1` |

私钥只保存在本机，不复制到服务器，不粘贴到聊天、Issue、日志或 `.env`，不得提交 Git。首次使用先确认权限：

```bash
chmod 600 ./Hackathon.pem
```

## 2. 本项目的上线取舍

为了路演速度，统一采用当前 `compose.yaml` 启动 Next.js、FastAPI 和 SQLite：

- 允许使用开发服务器、热重载和源码挂载；
- 暂不建设 Kubernetes、镜像仓库、蓝绿发布、集中日志和高可用数据库；
- 代码必须对应一个 Git commit，服务器只从 `main` 拉取，避免“本机能跑但无法复现”；
- `.env` 和 SQLite 数据不进 Git；
- 所有用户统一通过 `https://gks.socialdog.cn` 访问，不使用 SSH 隧道或公网 IP 直连；
- 公网只开放 `80/443`，前端和 API 仅绑定在服务器 Docker 网桥地址；
- HTTPS 证书由现有 Caddy 自动申请和续签，不安装 Certbot、不设置续签 cron；
- 数据不是资产，迁移阻塞且时间紧时，备份后可以重建 SQLite；
- 每次上线必须做首页、API、核心交互三个层级的验证，不能只看容器为 `Up`。

## 3. 首次初始化服务器

先登录并检查基础环境：

```bash
ssh -i ./Hackathon.pem ubuntu@1.14.75.189
docker --version
sudo docker compose version
git --version
sudo docker ps --filter name=anju-caddy-1
```

这台服务器的 `ubuntu` 用户当前不能直接访问 Docker daemon，所有会操作容器的 `docker` / `docker compose` 命令统一加 `sudo`；无需为了省略 `sudo` 修改用户组或重启 Docker。

Docker 或 Git 缺失时，先按对应 Ubuntu 版本安装。然后初始化代码目录：

```bash
sudo mkdir -p /opt/tea-bti
sudo chown ubuntu:ubuntu /opt/tea-bti
git clone https://github.com/banshanbans/Tea-BTI.git /opt/tea-bti
cd /opt/tea-bti
cp .env.example .env
```

如果目录已经完成克隆，不重复执行 `git clone`。

服务器当前已有 Caddy 占用 `80/443`，其配置位于 `/opt/anju/deploy/Caddyfile`。Tea-BTI 不得再启动第二个 Caddy，否则会端口冲突并影响服务器上的其他站点。

## 4. 配置远端 `.env`

在服务器 `/opt/tea-bti/.env` 中填写凭据。长期密钥只能放在这里，不要写进本文档。

部署环境固定使用同域名路径：

```dotenv
DATABASE_URL=sqlite:////data/tea-bti.db
WEB_ORIGIN=https://gks.socialdog.cn
NEXT_PUBLIC_API_URL=https://gks.socialdog.cn/api/v1
```

其余 AI/RTC 配置按 `.env.example` 补齐。真实语音演示使用 `AI_MODE=volcengine`，这样凭据缺失时会直接报错，不会悄悄降级成模拟能力。

实时语音使用 `StartVoiceChat 2025-06-01`。服务端 `.env` 至少需要 IAM AK/SK、RTC AppId/AppKey 和控制台导出的 `RTC_VOICE_CONFIG_JSON`；Taste 文本归一化另行使用 `ARK_API_KEY`。不要把另一个产品的系统提示、视觉配置、Tools 或 Function Calling 回调直接复制进 Tea-BTI。

`compose.yaml` 的 API 服务通过 `env_file: .env` 注入全部服务端变量，生产覆盖文件会继承该设置。`/opt/tea-bti/.env` 不受 `git pull` 影响，因此完成一次安全写入后，后续构建、迁移和重启都会自动注入；只有轮换凭据时才需要重新同步该文件。

## 5. 首次接入域名和 HTTPS

开始前必须同时满足：

- `gks.socialdog.cn` 的 A 记录指向 `1.14.75.189`；
- 云安全组向公网开放 TCP `80`、TCP `443`，可选开放 UDP `443`；
- 不向公网开放 `3000`、`8000`、`13000`、`18000`；
- `anju-caddy-1` 正常运行，`/opt/anju/deploy/Caddyfile` 可备份和修改。

截至 2026-08-29，公共 DNS 已验证指向 `1.14.75.189`。首次部署时仍要重新检查：

```bash
dig +short A gks.socialdog.cn
```

Tea-BTI 的域名配置已经保存在 `deploy/gks.socialdog.cn.caddy`。首次部署代码并启动前后端后，在服务器上执行一次：

```bash
sudo cp /opt/anju/deploy/Caddyfile \
  "/opt/anju/deploy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)"
sudo grep -q '^gks\.socialdog\.cn {' /opt/anju/deploy/Caddyfile || \
  sudo tee -a /opt/anju/deploy/Caddyfile < /opt/tea-bti/deploy/gks.socialdog.cn.caddy
sudo docker exec anju-caddy-1 \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo docker restart anju-caddy-1
```

现有 Caddy 配置关闭了管理 API，因此首次增加站点后采用容器重启加载配置，会让同一网关上的其他站点出现几秒钟短暂中断。后续普通 Tea-BTI 上线不需要重启 Caddy。

Caddy 会自动完成以下工作：

- 通过 ACME 申请 `gks.socialdog.cn` 的公开可信证书；
- 自动将 HTTP 重定向到 HTTPS；
- 在证书到期前自动续签；
- 将证书和状态保存在现有持久化卷中，容器重启后仍保留。

首次证书申请完成后验证：

```bash
curl -I https://gks.socialdog.cn
curl -fsS https://gks.socialdog.cn/healthz
sudo docker logs --tail=100 anju-caddy-1
```

若证书申请失败，优先检查 DNS、80/443 安全组和 Caddy 日志，不要手工签发另一套证书。

## 6. 每次上线的标准流程

### 6.1 本地发布前

只发布已经提交并推送到 `origin/main` 的版本：

```bash
git status --short
make brand-check
git push origin main
```

若 `git status --short` 有计划外改动，先处理后再上线。时间允许时再运行 `make api-test` 和 `make web-test`；修改核心交互或 API 契约时，这两项不能省略。

### 6.2 服务器更新

```bash
ssh -i ./Hackathon.pem ubuntu@1.14.75.189
cd /opt/tea-bti
git fetch origin
git pull --ff-only origin main
sudo docker compose -f compose.yaml -f compose.deploy.yaml build
sudo docker compose -f compose.yaml -f compose.deploy.yaml run --rm api alembic upgrade head
sudo docker compose -f compose.yaml -f compose.deploy.yaml up -d --remove-orphans
sudo docker compose -f compose.yaml -f compose.deploy.yaml ps
```

`git pull --ff-only` 失败时，不在服务器上强行合并或重置。先用 `git status --short` 查明远端目录是否被手工修改。

`compose.deploy.yaml` 将 Web/API 分别绑定到 `172.30.25.1:13000` 和 `172.30.25.1:18000`。这个地址是现有 Caddy 所在 Docker 网桥的宿主机网关，只供 Caddy 转发，不暴露为公共访问入口。

### 6.3 服务端冒烟验证

```bash
curl -fsS https://gks.socialdog.cn/healthz
curl -fsS https://gks.socialdog.cn/api/v1/capabilities
curl -fsS https://gks.socialdog.cn/ >/dev/null
sudo docker compose -f compose.yaml -f compose.deploy.yaml logs --tail=100 api web
sudo docker logs --tail=100 anju-caddy-1
```

通过标准：

1. API 健康检查成功；
2. 首页返回成功；
3. `capabilities` 中的真实/模拟能力与本次路演预期一致；
4. 日志没有持续的异常重启、数据库错误或前端编译错误。

## 7. 上线后必须手动走一遍

每次至少验证以下路径：

1. 首页可打开，品牌启动页、三杯破冰和八茶识别式 Feed 正常；
2. 点击“进入茶境”，确认不是只有页面跳转，而是开始接口成功且场景可交互；
3. 打开 AI 陪伴，确认浏览器获得麦克风权限；
4. 真实语音路演时，确认 `capabilities.voice` 不是 `mock`，并实际完成一次“用户说话 → 字幕 → AI 回答”；
5. 刷新页面一次，确认关键状态没有立即损坏。

## 8. 数据库迁移卡住时的快速处理

先看错误，不要一遇到问题就删库：

```bash
cd /opt/tea-bti
sudo docker compose -f compose.yaml -f compose.deploy.yaml logs --tail=200 api
sudo docker compose -f compose.yaml -f compose.deploy.yaml run --rm api alembic current
```

确认只是历史演示数据、并且迁移已阻塞上线时，按以下方式备份后重建：

```bash
sudo docker compose -f compose.yaml -f compose.deploy.yaml down
mkdir -p .data/backups
cp .data/tea-bti.db ".data/backups/tea-bti-$(date +%Y%m%d-%H%M%S).db"
rm .data/tea-bti.db
sudo docker compose -f compose.yaml -f compose.deploy.yaml run --rm api alembic upgrade head
sudo docker compose -f compose.yaml -f compose.deploy.yaml up -d
```

只有 `/opt/tea-bti/.data/tea-bti.db` 是这里允许删除的目标。不得对 `/opt`、`/opt/tea-bti` 或 `.data` 整体执行递归删除。

## 9. 快速回退

上线前记住旧版本 SHA：

```bash
cd /opt/tea-bti
git rev-parse HEAD
```

新版本阻塞路演时，切回确认可用的 commit：

```bash
cd /opt/tea-bti
git switch --detach <GOOD_SHA>
sudo docker compose -f compose.yaml -f compose.deploy.yaml build
sudo docker compose -f compose.yaml -f compose.deploy.yaml up -d --remove-orphans
```

回退后重复健康检查和完整手动路径。需要恢复跟随主分支时：

```bash
git switch main
git pull --ff-only origin main
```

如果旧代码无法读取新数据库，按上一节备份并重建演示数据库。

## 10. 故障时的时间盒

- 2 分钟内：检查 Compose 状态、API/Web/Caddy 最近 100 行日志和 `.env` 是否缺项；
- 5 分钟内：尝试重新构建、迁移、启动；
- 10 分钟仍未恢复：回退到已验证 SHA；
- 数据库兼容性阻塞：备份并重建演示库；
- 真实 AI 服务阻塞：明确展示不可用状态。只有路演方案允许时，才把 `AI_MODE` 改为 `auto` 使用模拟能力，且必须对现场说明。

## 11. 每次上线完成记录

在路演群或任务记录中留下以下信息即可：

```text
部署时间：
服务器：1.14.75.189
Git SHA：
访问地址：https://gks.socialdog.cn
HTTPS 证书：有效 / 失败
API healthz：通过 / 失败
首页：通过 / 失败
进入茶境：通过 / 失败
AI 语音：真实已验证 / 模拟已验证 / 未验证
已知问题：
回退 SHA：
```

“容器已启动”不等于“上线完成”；只有上述验证完成后才能报告可路演。
