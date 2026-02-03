# Rabithua/openclaw

Personal **OpenClaw** repository containing the **skills** and **local services** that I maintain and deploy for my own workflow.

## 快速开始

```bash
# 1. 配置环境变量
cp services/traveler/.env.example services/traveler/.env
cp services/webhookd/.env.example services/webhookd/.env

# 编辑配置文件
vim services/traveler/.env
vim services/webhookd/.env

# 2. 启动所有服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f
```

## 服务说明

### Traveler (端口 8788)
RSS 订阅助手 - 抓取 RSS，交给 OpenClaw AI 筛选，发布到 Rote
- 健康检查: `curl http://localhost:8788/healthz`
- 手动抓取: `docker-compose exec traveler deno task run`

### Webhookd (端口 8787)
GitHub webhook 接收器 - 转发 GitHub 事件到 OpenClaw
- 健康检查: `curl http://localhost:8787/healthz`

## 常用命令

```bash
docker-compose up -d           # 启动
docker-compose down            # 停止
docker-compose logs -f         # 查看日志
docker-compose restart traveler # 重启服务
```

## Repository layout

- `services/`
  - `webhookd/` – GitHub webhook receiver
  - `traveler/` – AI-driven RSS reader
- `skills/`
  - `rote-notes/` – Rote API skill

## Conventions

### Security note (important)

OpenClaw and webhook receivers like `webhookd` can reduce risk with signatures, allowlists, dedupe, and loop-prevention — but **nothing is perfectly secure**.

- Assume there is always some risk of prompt-injection, misconfiguration, or remote abuse.
- Keep secrets out of repos.
- Prefer running OpenClaw + local services **inside Docker** (or another sandbox) with minimal privileges.
- Do not expose internal ports directly to the public Internet; use a tunnel/reverse proxy and keep auth enabled.


### Skills implementation default

- New skills (especially helper CLIs under `skills/<name>/scripts/`) should default to **TypeScript + Deno**.
- Prefer single-file Deno scripts (`.ts`) with explicit permissions (e.g. `--allow-net --allow-env`).
- Avoid Python for new skills unless there is a strong reason (keep the toolchain consistent).

### Secrets & local-only files

- **Never commit** `.env`, private keys, certificates, or machine-specific files.
- Use `*.env.example` as templates.
- Local machine files belong in `.local/` (ignored by git).

### GitHub reply signature

Automated GitHub replies should end with a consistent signature.

- Default: `— replied by OpenClaw assistant`
- Configurable via `GITHUB_REPLY_SIGNATURE` in `services/webhookd/.env`.

This signature is also used for **loop prevention** (the webhook service ignores comments containing the signature).

## 详细配置

### Traveler
详见 [services/traveler/README.md](services/traveler/README.md)

### Webhookd  
详见 [services/webhookd/README.md](services/webhookd/README.md)

### Skills
- `skills/rote-notes/` – Rote API skill
