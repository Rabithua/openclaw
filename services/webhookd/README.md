# webhookd

A thin webhook receiver/normalizer that verifies incoming webhooks (currently GitHub) and forwards
them to OpenClaw via `POST /tools/invoke`.

This is intentionally **small and dumb**:

- Verify signatures (GitHub `X-Hub-Signature-256`)
- Apply guardrails (ignore self-comments / ignore actors / action allowlist / dedupe)
- Forward a structured envelope to OpenClaw (so the "real" logic lives in your agent)

## Features

- GitHub events supported:
  - `issues`
  - `issue_comment`
  - `pull_request`
  - `pull_request_review`
  - `pull_request_review_comment`
- Safety guardrails:
  - Avoid reply loops by ignoring comments that contain the configured signature (env
    `GITHUB_REPLY_SIGNATURE`)
  - Ignore specific GitHub actors (e.g. yourself / bots)
  - Only act on a small set of high-signal actions (to avoid double replies like `opened` +
    `labeled`)
  - Idempotency/dedupe cache (in-memory TTL) to avoid duplicates on retries

## Requirements

- Deno 2.x
- An OpenClaw Gateway running locally (default `http://127.0.0.1:18789`) with token auth enabled

## Setup

For a complete “keep it running + public ingress + GitHub config” walkthrough, see:

- **DEPLOY.md**: [Deploying webhookd](./DEPLOY.md)

1. Copy env file:

```bash
cd services/webhookd
cp .env.example .env
```

2. Fill `.env`:

- `OPENCLAW_GATEWAY_TOKEN`: from `openclaw.json` gateway auth token
- `GITHUB_WEBHOOK_SECRET`: must match GitHub webhook "Secret"

3. Run locally:

```bash
deno task start
# or: deno run -A --env-file=.env mod.ts
```

Health check:

```bash
curl http://127.0.0.1:8787/healthz
```

## Exposing to the Internet (recommended: Tailscale Funnel)

If you have Tailscale installed on the same machine:

```bash
tailscale cert <your-node>.ts.net
tailscale funnel --bg http://127.0.0.1:8787
```

Then set your GitHub webhook URL to:

- `https://<your-node>.ts.net/webhook`

## GitHub Webhook config

- Payload URL: `https://<public-host>/webhook`
- Content type: `application/json`
- Secret: must match `GITHUB_WEBHOOK_SECRET`
- Events: pick what you need (issues / issue_comment / pull_request / reviews)

## Notes on "no such host" / broken DNS on macOS

If you run Surge as a gateway (TUN) it may set macOS DNS to a virtual resolver (e.g. `198.18.0.2`).
`nslookup` might look wrong even when `/etc/hosts` works.

When `tailscale cert` fails with `lookup ... no such host`, you can temporarily pin
`mac-mini.tail*.ts.net` and the ACME hostnames in `/etc/hosts`.

## Development

```bash
deno fmt
deno check mod.ts
```

## Design: what gets forwarded to OpenClaw

`webhookd` calls OpenClaw `sessions_spawn` with a task containing:

- A human-readable summary
- A `Context (structured)` JSON envelope containing `{source,event,delivery,receivedAt,payload}`

Your OpenClaw agent decides what to do (triage, comment on GitHub, notify Telegram, etc.).
