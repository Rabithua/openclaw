# Rabithua/openclaw

Personal **OpenClaw** repository containing the **skills** and **local services** that I maintain and deploy for my own workflow.

This repo is intended to be:
- **Portable**: clone on a new machine and re-run the same setup.
- **Safe**: no secrets committed.
- **Practical**: focuses on automation glue (webhooks, triage, replies), not business logic.

## Repository layout

- `services/`
  - `webhookd/` – a small Deno-based webhook receiver that verifies GitHub webhooks and forwards them to OpenClaw.
- `skills/`
  - `rote-notes/` – custom skill for interacting with a Rote instance.

## Conventions

### Secrets & local-only files

- **Never commit** `.env`, private keys, certificates, or machine-specific files.
- Use `*.env.example` as templates.
- Local machine files belong in `.local/` (ignored by git).

### GitHub reply signature

Automated GitHub replies should end with a consistent signature.

- Default: `— replied by OpenClaw assistant`
- Configurable via `GITHUB_REPLY_SIGNATURE` in `services/webhookd/.env`.

This signature is also used for **loop prevention** (the webhook service ignores comments containing the signature).

## services/webhookd

`webhookd` is a thin forwarder:

1) verifies GitHub signatures (`X-Hub-Signature-256`)
2) applies guardrails (ignore actors, ignore self-comments, action allowlist, idempotency)
3) forwards a structured envelope to OpenClaw via `POST /tools/invoke` (typically `sessions_spawn`)

### Supported GitHub events

- `issues` (acts on `opened`)
- `issue_comment` (acts on `created`, ignores self-comments)
- `pull_request` (acts on `opened`, `reopened`, `ready_for_review`)
- `pull_request_review` (acts on `submitted`)
- `pull_request_review_comment` (acts on `created`, ignores self-comments)

### Quick start

```bash
cd services/webhookd
cp .env.example .env
# edit .env

deno task start
# or: deno run -A --env-file=.env mod.ts
```

Health check:

```bash
curl http://127.0.0.1:8787/healthz
```

### Exposing webhookd publicly (Tailscale Funnel)

Recommended approach for home networks / CGNAT:

```bash
tailscale cert <your-node>.ts.net
tailscale funnel --bg http://127.0.0.1:8787
```

Then set GitHub webhook URL to:

- `https://<your-node>.ts.net/webhook`

### Avoiding reply loops & duplicates

`webhookd` includes guardrails to avoid spam:

- ignores comments that contain the configured signature
- ignores configured actors (`IGNORE_GITHUB_ACTORS`)
- dedupes deliveries for a TTL window (`DEDUPE_TTL_MS`)
- only acts on high-signal actions (to avoid double replies like `opened` + `labeled`)

### macOS note (Surge gateway / weird DNS)

If you run Surge in TUN/gateway mode, macOS DNS may point to a virtual resolver (e.g. `198.18.x.x`).
In that case `nslookup` can look wrong even when `/etc/hosts` works.
If `tailscale cert` fails with `lookup ... no such host`, pin the relevant hostnames in `/etc/hosts` temporarily.

## Skills

Each skill is self-documented in its `SKILL.md`.

- `skills/rote-notes/` – create/search/list notes via the Rote OpenKey API.

## Development

```bash
# webhookd
cd services/webhookd

deno fmt

deno check mod.ts
```

## License

Personal repository; add a license if you plan to reuse/distribute.
