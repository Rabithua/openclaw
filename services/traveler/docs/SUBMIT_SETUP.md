# Traveler 信息源提交接口

在 OpenClaw Traveler
服务中添加了一个新的接受通知和信息源提交的接口（`/traveler/submit`）。这允许用户主动向系统提交信息源项，由
OpenClaw 自动阅读和处理。

## 快速开始

### 1. 配置环境变量

编辑或创建 `.env` 文件（复制自 `.env.example`）：

```bash
# 必需：设置 API Token
TRAVELER_API_TOKEN=your-secret-api-token-here

# 可选：设置 HMAC Secret（用于 webhook 签名）
TRAVELER_HMAC_SECRET=your-hmac-secret-key-here

# 可选：自定义端口（默认 8788）
TRAVELER_PORT=8788

# 可选：使用 OpenClaw 进行评分（未配置则退回本地启发式评分）
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-openclaw-gateway-token
```

### 2. 启动服务

```bash
# 使用 deno task
deno task server

# 或直接运行
set -a; source .env; set +a
deno run -A src/server.ts
```

服务会输出：

```
✓ Traveler submit server listening on http://127.0.0.1:8788
  POST /traveler/submit - Submit feed items
  GET  /healthz       - Health check
```

### 3. 提交信息源

```bash
curl -X POST http://localhost:8788/traveler/submit \
  -H "X-API-Token: your-secret-api-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "my-blog",
    "feed_items": [
      {
        "title": "Article Title",
        "url": "https://example.com/article",
        "summary": "Article summary or description",
        "published_at": "2024-01-15T10:00:00Z"
      }
    ]
  }'
```

## API 详细文档

详见 [SUBMIT_API.md](SUBMIT_API.md)

## 新增文件

### 核心处理器

- **`src/handlers/submit.ts`** - 提交请求处理和验证逻辑
- **`src/utils/auth.ts`** - 认证验证（API Token 和 HMAC-SHA256）
- **`src/utils/http.ts`** - HTTP 工具函数
- **`src/server.ts`** - 主服务器入口

### 文档和测试

- **`SUBMIT_API.md`** - 完整的 API 文档
- **`.env.example`** - 已更新，包含新的环境变量说明
- **`tests/test-submit.sh`** - 测试脚本（bash）
- **`deno.json`** - 已更新，添加 `server` task

## 功能特性

### 安全机制

提供两种认证方式，可任选其一：

1. **API Token 方式**（推荐用于脚本）
   - 在请求头中包含 `X-API-Token: <token>`
   - 简单直接，适合自动化脚本

2. **HMAC-SHA256 签名方式**（推荐用于 webhook）
   - 对请求体进行签名，在 `X-Signature` 头中包含
   - 更安全，防止中间人攻击

### 智能处理流程

1. **认证验证** - 验证 API Token 或 HMAC 签名
2. **请求验证** - 检查必需字段和约束
3. **去重检查** - 使用本地状态文件防止重复处理
4. **评分** - 根据配置的兴趣标签对项目评分
5. **筛选** - 过滤低于最小分数的项目
6. **写入** - 将高分项目写入 Rote 笔记系统

### 配置支持

在 `configs/default.yaml` 中配置：

```yaml
# 兴趣标签过滤
interests:
  include:
    - "machine learning"
    - "artificial intelligence"
  exclude:
    - "advertisement"

# 排名和处理规则
ranking:
  min_score: 0.3 # 项目最低评分（0-1）
  dedupe_window_days: 7 # 去重时间窗口
  daily_limit: 50 # 每日处理上限

# 输出配置
output:
  rote:
    tags: ["inbox", "traveler"]
    add_daily_digest: false
```

## 限制

- **单次请求最多 100 项** - 防止过大请求
- **必需字段** - `source_name`, `title`, `url` 是必需的
- **URL 验证** - 必须以 `http://` 或 `https://` 开头
- **重复检查** - 7 天内同一 URL 不会被再次处理（可配置）

## 错误处理

服务返回标准 JSON 错误响应：

```json
{
  "ok": false,
  "error": "error_code: error_message"
}
```

常见错误：

- `unauthorized: invalid or missing credentials` (401)
- `invalid_json` (400)
- `invalid_request: source_name and feed_items are required` (400)
- `internal_error` (500)

## 使用示例

### Python 脚本

```python
import requests

def submit_to_traveler(items, source_name="my-source"):
    """提交信息源到 Traveler"""
    url = "http://localhost:8788/traveler/submit"
    headers = {
        "X-API-Token": "your-secret-token",
        "Content-Type": "application/json"
    }
    payload = {
        "source_name": source_name,
        "feed_items": items
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

# 使用
items = [
    {
        "title": "New ML Paper",
        "url": "https://arxiv.org/abs/2401.12345",
        "summary": "Breakthrough in transformer architecture",
        "published_at": "2024-01-15T10:00:00Z"
    }
]

result = submit_to_traveler(items, source_name="arxiv")
print(result)
# 输出: {"ok": true, "processed": 1, "rejected": 0, "message": "..."}
```

### Node.js/TypeScript

```typescript
import crypto from "crypto";

async function submitWithHmac(items: any[], sourceNme: string, secret: string) {
  const body = JSON.stringify({
    source_name: sourceName,
    feed_items: items,
  });

  const signature = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const response = await fetch("http://localhost:8788/traveler/submit", {
    method: "POST",
    headers: {
      "X-Signature": signature,
      "Content-Type": "application/json",
    },
    body,
  });

  return response.json();
}
```

### GitHub Actions 工作流

```yaml
name: Submit Articles to Traveler

on:
  schedule:
    - cron: "0 */4 * * *" # 每 4 小时运行一次

jobs:
  submit:
    runs-on: ubuntu-latest
    steps:
      - name: Collect and submit articles
        run: |
          curl -X POST http://api.example.com:8788/traveler/submit \
            -H "X-API-Token: ${{ secrets.TRAVELER_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{...}'
```

## 测试

运行测试脚本：

```bash
chmod +x tests/test-submit.sh
API_TOKEN="your-secret-token" ./tests/test-submit.sh
```

或使用 curl 进行单个测试：

```bash
# 健康检查
curl http://localhost:8788/healthz

# 提交单个项目
curl -X POST http://localhost:8788/traveler/submit \
  -H "X-API-Token: test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "test",
    "feed_items": [{
      "title": "Test",
      "url": "https://example.com/test"
    }]
  }'
```

## 架构集成

```
┌─────────────────────────────────────────┐
│ 外部信息源 (用户、第三方应用等)         │
└─────────────────┬───────────────────────┘
                  │
                  │ POST /traveler/submit
                  ▼
        ┌─────────────────────┐
        │  Traveler Submit    │
        │    HTTP Server      │
        │ (src/server.ts)     │
        └────────┬────────────┘
                 │
        ┌────────▼──────────┐
        │   Authentication  │
        │  (API Token/HMAC) │
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │  Submit Handler   │
        │ (handlers/submit) │
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │   Processing      │
        │  - De-duplicate   │
        │  - Score         │
        │  - Filter        │
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │  Rote API         │
        │  Write Notes      │
        └───────────────────┘
```

## 环境变量参考

| 变量                   | 必需 | 默认值               | 说明           |
| ---------------------- | ---- | -------------------- | -------------- |
| `TRAVELER_API_TOKEN`   | ✓    | -                    | API 认证 Token |
| `TRAVELER_HMAC_SECRET` | -    | -                    | HMAC 签名密钥  |
| `TRAVELER_PORT`        | -    | 8788                 | 服务监听端口   |
| `TRAVELER_CONFIG`      | -    | configs/default.yaml | 配置文件路径   |
| `ROTE_API_BASE`        | ✓    | -                    | Rote API 地址  |
| `ROTE_OPENKEY`         | ✓    | -                    | Rote API Key   |

## 故障排除

**问题：401 Unauthorized**

- 检查 `TRAVELER_API_TOKEN` 是否正确设置
- 确保请求头中的 token 与环境变量匹配
- 对于 HMAC，检查签名计算是否正确

**问题：500 Internal Error**

- 检查 `ROTE_API_BASE` 和 `ROTE_OPENKEY` 是否正确配置
- 查看服务器日志了解详细错误信息
- 确保 Rote API 服务可访问

**问题：项目被拒绝（rejected）**

- 检查配置的 `min_score` 阈值
- 验证 `interests.exclude` 是否过滤了该项目
- 检查 `dedupe_window_days` 是否导致重复检查

## 后续改进

- [ ] 支持批量查询提交状态
- [ ] 添加请求日志和审计追踪
- [ ] 实现速率限制（Rate Limiting）
- [ ] 支持更多认证方式（OAuth、JWT 等）
- [ ] 添加 WebSocket 支持实时通知
- [ ] 实现提交队列和异步处理
