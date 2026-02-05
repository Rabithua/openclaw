# Rabithua/openclaw

Personal **OpenClaw** repository containing the **skills** and **local services** that I maintain and deploy for my own workflow.

## Quick Start

```bash
# 1. Configure environment variables
cp services/traveler/.env.example services/traveler/.env
cp services/webhookd/.env.example services/webhookd/.env

# Edit configuration files
vim services/traveler/.env
vim services/webhookd/.env

# 2. Start all services
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

## Services

### Traveler (Port 8788)

RSS Subscription Assistant - Fetches RSS, filters via OpenClaw AI, and publishes to Rote.

- Health Check: `curl http://localhost:8788/healthz`
- Manual Fetch: `docker-compose exec traveler deno task run`

### Webhookd (Port 8787)

GitHub Webhook Receiver - Forwards GitHub events to OpenClaw.

- Health Check: `curl http://localhost:8787/healthz`

## Common Commands

```bash
docker-compose up -d           # Start
docker-compose down            # Stop
docker-compose logs -f         # View logs
docker-compose restart traveler # Restart service
```

## Repository Layout

- `services/`
  - `webhookd/` – GitHub webhook receiver
  - `traveler/` – AI-driven RSS reader
- `skills/`
  - `rote-notes/` – Rote API skill

## Conventions

### Security Note (Important)

OpenClaw and webhook receivers like `webhookd` can reduce risk with signatures, allowlists, dedupe, and loop-prevention — but **nothing is perfectly secure**.

- Assume there is always some risk of prompt-injection, misconfiguration, or remote abuse.
- Keep secrets out of repos.
- Prefer running OpenClaw + local services **inside Docker** (or another sandbox) with minimal privileges.
- Do not expose internal ports directly to the public Internet; use a tunnel/reverse proxy and keep auth enabled.

### Skills Implementation Default

- New skills (especially helper CLIs under `skills/<name>/scripts/`) should default to **TypeScript + Deno**.
- Prefer single-file Deno scripts (`.ts`) with explicit permissions (e.g. `--allow-net --allow-env`).
- Avoid Python for new skills unless there is a strong reason (keep the toolchain consistent).

### Secrets & Local-only Files

- **Never commit** `.env`, private keys, certificates, or machine-specific files.
- Use `*.env.example` as templates.
- Local machine files belong in `.local/` (ignored by git).

### GitHub Reply Signature

Automated GitHub replies should end with a consistent signature.

- Default: `— replied by OpenClaw assistant`
- Configurable via `GITHUB_REPLY_SIGNATURE` in `services/webhookd/.env`.

This signature is also used for **loop prevention** (the webhook service ignores comments containing the signature).

## Detailed Configuration

### Traveler

See [services/traveler/README.md](services/traveler/README.md)

### Webhookd

See [services/webhookd/README.md](services/webhookd/README.md)

### Skills

- `skills/rote-notes/` – Rote API skill
