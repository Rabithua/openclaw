# Deploying `webhookd` (production-ish)

This guide shows a complete, practical setup for running `webhookd` as a long-lived service that receives GitHub webhooks, verifies them, and forwards a normalized event to OpenClaw.

> `webhookd` is intentionally small: it **does not** contain your “business logic”. It only verifies + normalizes + forwards.

---

## Overview

**Flow:**

GitHub → (public URL) `webhookd` → `OpenClaw Gateway /tools/invoke` → `sessions_spawn` → your agent decides what to do.

**You will configure:**

- `webhookd` runtime env (`.env`)
- a public ingress (recommended: **Tailscale Funnel**)
- GitHub repository webhooks

---

## Prerequisites

- OpenClaw Gateway running on the same machine (default `http://127.0.0.1:18789`) with token auth enabled.
- Deno 2.x (or Docker, see below).
- A way to expose `webhookd` to GitHub (public URL):
  - Recommended: **Tailscale Funnel**
  - Alternative: any reverse proxy / tunnel that can forward HTTPS → localhost

---

## 1) Configure `.env`

```bash
cd services/webhookd
cp .env.example .env
```

Edit `.env`:

- `OPENCLAW_GATEWAY_URL` (usually `http://127.0.0.1:18789`)
- `OPENCLAW_GATEWAY_TOKEN` (from `~/.openclaw/openclaw.json` → `gateway.auth.token`)
- `GITHUB_WEBHOOK_SECRET` (generate and set the same value in GitHub webhook settings)

**Important:** quote values that may confuse dotenv parsing (for example the long dash in the default signature):

```env
GITHUB_REPLY_SIGNATURE="— replied by OpenClaw assistant"
```

### Security notes

- Treat `OPENCLAW_GATEWAY_TOKEN` and `GITHUB_WEBHOOK_SECRET` as secrets.
- Never commit `.env`.
- Prefer binding `webhookd` to localhost and only exposing it via a tunnel/reverse proxy.

---

## 2) Run `webhookd`

### Option A (recommended): Deno directly

From `services/webhookd/`:

```bash
deno run -A --env-file=.env mod.ts
# or
# deno task start   (must be defined to include --env-file)
```

Health check:

```bash
curl http://127.0.0.1:8787/healthz
```

### Option B: Docker (long-lived)

This repo does not ship a Dockerfile for `webhookd` by default.
If you prefer Docker, the simplest approach is to use the official Deno image and mount the code:

```bash
docker run -d --name webhookd \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -v "$(pwd)":/app \
  -w /app \
  denoland/deno:2.6.7 \
  deno run -A --env-file=.env mod.ts
```

(Adjust the Deno version as you like.)

---

## 3) Keep it running

### Option A: systemd (Linux)

Create `/etc/systemd/system/webhookd.service`:

```ini
[Unit]
Description=webhookd (GitHub webhook receiver → OpenClaw)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/path/to/openclaw/services/webhookd
ExecStart=/usr/bin/deno run -A --env-file=.env mod.ts
Restart=always
RestartSec=2

# Optional hardening (tune for your environment)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now webhookd
sudo systemctl status webhookd
journalctl -u webhookd -f
```

### Option B: Docker restart policy

If you used the Docker command above, `--restart unless-stopped` is usually sufficient.

---

## 4) Expose `webhookd` publicly (GitHub needs HTTPS)

### Recommended: Tailscale Funnel

On the same machine that runs `webhookd`:

```bash
tailscale cert <your-node>.ts.net
# Forward public HTTPS → local HTTP
tailscale funnel --bg http://127.0.0.1:8787
```

Your webhook URL becomes:

- `https://<your-node>.ts.net/webhook`

### Alternatives

- Cloudflare Tunnel / reverse proxy / nginx / Caddy, etc.
- If you use a reverse proxy, forward `POST /webhook` to `http://127.0.0.1:8787/webhook`.

---

## 5) Configure GitHub Webhook(s)

In the target GitHub repo:

Settings → Webhooks → Add webhook

- **Payload URL**: `https://<public-host>/webhook`
- **Content type**: `application/json`
- **Secret**: set to the same value as `GITHUB_WEBHOOK_SECRET`
- **Events**: choose what you want `webhookd` to react to
  - Issues
  - Issue comments
  - Pull requests
  - Pull request reviews
  - Pull request review comments

After saving, use **“Test delivery”** to validate.

---

## 6) Troubleshooting

### 401 signature_verification_failed

- Your GitHub webhook Secret and `GITHUB_WEBHOOK_SECRET` don’t match.
- Make sure GitHub is using `application/json` content-type.

### 503/connection errors when forwarding to OpenClaw

- Ensure OpenClaw Gateway is running and reachable at `OPENCLAW_GATEWAY_URL`.
- Confirm the token is correct.

### Duplicate replies / loops

- Ensure your comment signature is stable (`GITHUB_REPLY_SIGNATURE`).
- Add your GitHub username and bots to `IGNORE_GITHUB_ACTORS`.

### Environment variables not applied

- Ensure you are starting with `--env-file=.env`.
- If using `deno task start`, confirm the task includes `--env-file=.env`.

---

## Operational tips

- Keep `webhookd` stateless.
- Don’t broaden the action allowlist without a reason; it’s easy to spam.
- Prefer least-privilege GitHub tokens in the agent that posts replies.
