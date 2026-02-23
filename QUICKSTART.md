# OpenClaw Services - Docker 快速开始

## 3 步启动

```bash
# 1. 配置环境变量
cp .env.example .env
vim .env  # 填入必要配置

# 2. 启动所有服务
docker-compose up -d

# 3. 查看运行状态
docker-compose ps
```

## 必需配置

编辑 `.env` 文件，填入：

```bash
# OpenClaw 配置
OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789
OPENCLAW_GATEWAY_TOKEN=your-token

# Rote 配置（用于 Traveler）
ROTE_OPENKEY=your-rote-openkey

# Traveler 去重库（可选，建议保留默认）
TRAVELER_DB_PATH=.local/state/traveler.db

# GitHub Webhook 密钥（用于 Webhookd）
GITHUB_WEBHOOK_SECRET=your-github-secret
```

## OpenClaw 网关权限（必须）

`traveler` 和 `webhookd` 会调用 OpenClaw 的 `/tools/invoke` 来触发会话。
根据 OpenClaw 最新文档，HTTP 调用默认会拒绝部分高风险工具；如果未放行会出现：
`Tool not available: sessions_spawn`。

请在本机 `~/.openclaw/openclaw.json` 中加入：

```json
{
  "gateway": {
    "tools": {
      "allow": ["sessions_spawn"]
    }
  }
}
```

然后重启网关：

```bash
openclaw gateway restart
```

如果出现 `gateway closed (1008): pairing required`，通常不是 token 错误，而是网关认为调用方设备未配对。可执行：

```bash
openclaw devices list
openclaw doctor --repair
```

或者在 OpenClaw 控制台里批准 pending 的 pairing/device 请求。

## 常用命令

```bash
# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 手动触发 Traveler 抓取
docker-compose exec traveler deno task run

# 进入容器调试
docker-compose exec traveler sh
docker-compose exec webhookd sh
```

## 服务端口

- **Traveler**: http://localhost:8788
  - `GET /healthz` - 健康检查
  - `POST /traveler/submit` - 提交内容

- **Webhookd**: http://localhost:8787
  - `GET /healthz` - 健康检查
  - `POST /webhook` - GitHub webhook 端点

## 更多信息

- Traveler 详细配置: [services/traveler/README.md](services/traveler/README.md)
- Webhookd 详细配置: [services/webhookd/README.md](services/webhookd/README.md)
