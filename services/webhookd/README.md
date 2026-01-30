# webhookd

Local webhook receiver (Deno) that **forwards verified webhooks to OpenClaw**.

Currently supported:
- GitHub Webhooks: `issues` (action: `opened`)

## Run

```bash
cd ~/Documents/openclaw/services/webhookd
export PORT=8787
export WEBHOOK_PATH=/webhook

# OpenClaw Gateway (local)
export OPENCLAW_GATEWAY_URL='http://127.0.0.1:18789'
export OPENCLAW_GATEWAY_TOKEN='...'

# GitHub webhook verify secret
export GITHUB_WEBHOOK_SECRET='...'

deno task start
```

## Cloudflare Tunnel

Expose the local service:

```bash
cloudflared tunnel --url http://localhost:8787
```

Then set GitHub Webhook Payload URL to:

`https://<random>.trycloudflare.com/webhook`
