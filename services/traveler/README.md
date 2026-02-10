# Traveler - AI-Driven RSS Subscription Assistant

Simple, intelligent RSS subscription management, fully decided by OpenClaw AI.

## Core Philosophy

**Let AI decide, no complex rules.**

Traditional RSS readers require you to set up complex filtering rules, scoring
algorithms, keyword matching... all of which are too troublesome.

Traveler's approach is simple:

1. Fabricates RSS feed content.
2. Sends all content to OpenClaw.
3. The agent filters, selects, and publishes to Rote directly using injected
   credentials.

## Quick Start

### 1. Prerequisites

- Deployed OpenClaw (local or remote)
- Rote account and OpenKey

### 2. Configuration

```bash
cd services/traveler

# Copy environment template
cp .env.example .env

# Edit .env, mandatory configuration:
# - OPENCLAW_GATEWAY_URL (OpenClaw address)
# - OPENCLAW_GATEWAY_TOKEN (OpenClaw access token)
# - ROTE_API_BASE (Rote API address)
# - ROTE_OPENKEY (Your Rote OpenKey)
# Optional but recommended:
# - TRAVELER_DB_PATH (SQLite dedupe DB, default .local/state/traveler.db)
```

**Note:** `ROTE_API_BASE` and `ROTE_OPENKEY` are read by Traveler and passed to
the OpenClaw agent, enabling the agent to use Rote tools on your behalf.

If using Docker, configure the same variables in the project root `.env`
(docker-compose reads the root `.env` and injects container environment
variables).

### 3. Add Subscriptions

Edit `configs/default.yaml`:

```yaml
sources:
  - type: rss
    name: "Hacker News"
    url: "https://hnrss.org/frontpage"

  - type: rss
    name: "Ruanyifeng's Blog"
    url: "https://www.ruanyifeng.com/blog/atom.xml"
```

### 4. Run

**Method 1: Using Docker (Recommended)**

```bash
# Start server mode
docker-compose up -d

# View logs
docker-compose logs -f

# Manually trigger a fetch
docker-compose exec traveler deno task run
```

Notes:

- The container will not read a separate `.env` file inside.
- After configuring environment variables via the root `.env`, execute
  `docker-compose up -d --force-recreate` to apply changes.

**Method 2: Direct Run**

```bash
# Single run
deno task run

# Or start HTTP server
deno task server
```

When running locally, ensure the current shell has the corresponding environment
variables (use `set -a; source .env; set +a` to load).

For detailed Docker usage instructions, please check [DOCKER.md](DOCKER.md).

### Built-in Scheduler (Server Mode)

If you want Traveler to fetch and notify OpenClaw regularly, you can enable the
built-in scheduler in `deno task server` mode:

```
TRAVELER_SCHEDULE_INTERVAL_MINUTES=60
TRAVELER_SCHEDULE_RUN_ON_START=true
```

Notes:

- Only effective in `server` mode.
- `TRAVELER_SCHEDULE_INTERVAL_MINUTES > 0` enables it.
- To avoid overlapping executions, it will automatically skip the current
  trigger if the previous one hasn't finished.

### Deduplication Storage

Traveler stores dedupe state in SQLite:

```
TRAVELER_DB_PATH=.local/state/traveler.db
```

Notes:

- Default path is `.local/state/traveler.db`.
- In Docker Compose, `.local/` is mounted to a named volume, so dedupe state
  survives container restarts/recreates.
- On first run, Traveler automatically migrates legacy `state/seen.json` if
  present.

## Workflow

```
RSS Feeds
    ↓
Fetch New Content
    ↓
Deduplication (Avoid duplicates within 7 days)
    ↓
Send to OpenClaw AI (with Rote credentials)
    ↓
AI Browses & Filters
    ↓
AI Writes Interesting Content to Rote Notes
```

## Configuration Guide

### persona

Define the AI assistant's identity and behavioral guidelines:

```yaml
persona:
  name: Traveler # AI Name
  voice: "curious, concise, insightful" # Tone style
  boundaries: # Behavioral guidelines
    - "Distinguish between facts and opinions"
    - "Always include the original link"
```

### interests

Help AI understand your interest direction:

```yaml
interests:
  include: # Topics of interest
    - "Open Source Projects"
    - "AI Tools"
    - "System Design"
  exclude: # Topics to ignore
    - "Celebrity Gossip"
    - "Clickbait"
```

### output

```yaml
output:
  rote:
    tags: ["inbox", "traveler"] # Tags when publishing to Rote
```

## HTTP API (Optional)

If server mode is started (`deno task server`), you can actively submit content
via API:

### POST /traveler/submit

```bash
curl -X POST http://127.0.0.1:8788/traveler/submit \
  -H "X-API-Token: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "My Collection",
    "feed_items": [
      {
        "title": "Interesting Article",
        "url": "https://example.com/article",
        "summary": "This is a great article...",
        "published_at": "2024-01-01T00:00:00Z"
      }
    ]
  }'
```

See [SUBMIT_API.md](docs/SUBMIT_API.md) for details.

## Cron Execution

Execute using cron:

```bash
# Run every hour
0 * * * * cd /path/to/openclaw/services/traveler && deno task run

# Or use systemd timer, launchd, etc.
```

## Why not traditional scoring systems?

Problems with traditional methods:

- Need to write complex keyword matching rules.
- Rules are hard to maintain and easily outdated.
- Cannot understand context and semantics.
- High false positive rate.

Benefits of AI-driven:

- AI can understand the real content and value of articles.
- Automatically adapts to new topics and fields.
- No need to maintain rules, just tell it your interests.
- Smarter and more flexible decision making.

## Tech Stack

- **Deno** - TypeScript Runtime
- **OpenClaw** - AI Decision Engine
- **Rote** - Note System

## License

Personal project, please add license yourself if reusing.
