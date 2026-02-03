# Traveler Submit API

提交信息源接口，允许用户主动向 OpenClaw 提交 RSS 信息源项。

## 启动服务

```bash
# 设置必要的环境变量
export TRAVELER_API_TOKEN="your-secret-token"    # 方式1: API Token
export TRAVELER_HMAC_SECRET="your-hmac-secret"   # 方式2: HMAC Secret (可选)
export TRAVELER_PORT=8788                         # 默认: 8788
export TRAVELER_CONFIG=configs/default.yaml       # 默认: configs/default.yaml

# 运行服务
deno run -A src/server.ts
```

## API 端点

### POST /traveler/submit

提交一批信息源项。

**请求格式**：

```json
{
  "source_name": "my-blog",
  "feed_items": [
    {
      "title": "Article Title",
      "url": "https://example.com/article",
      "summary": "Optional article summary or description",
      "published_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**字段说明**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `source_name` | string | ✓ | 信息源名称（用于标记内容来源） |
| `feed_items` | array | ✓ | 项目数组，最多 100 项 |
| `feed_items[].title` | string | ✓ | 项目标题 |
| `feed_items[].url` | string | ✓ | 项目链接（必须是 http/https） |
| `feed_items[].summary` | string | - | 项目摘要或描述 |
| `feed_items[].published_at` | string | - | 发布时间（ISO 8601 格式） |

**响应格式**：

成功 (200):
```json
{
  "ok": true,
  "processed": 5,
  "rejected": 2,
  "message": "Processed 5 item(s), rejected 2 item(s)"
}
```

失败 (400/401/500):
```json
{
  "ok": false,
  "error": "invalid_request: source_name and feed_items are required"
}
```

## 安全机制

支持两种认证方式：

### 方式1: API Token (推荐用于脚本)

在请求头中包含 API token：

```bash
curl -X POST http://localhost:8788/traveler/submit \
  -H "X-API-Token: your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "my-source",
    "feed_items": [...]
  }'
```

### 方式2: HMAC-SHA256 签名 (推荐用于 webhook)

对请求体进行 HMAC-SHA256 签名：

```bash
# 计算签名（示例，使用 Node.js）
const crypto = require('crypto');
const body = JSON.stringify({...});
const secret = process.env.TRAVELER_HMAC_SECRET;
const signature = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');
```

然后在请求头中包含签名：

```bash
curl -X POST http://localhost:8788/traveler/submit \
  -H "X-Signature: sha256=..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## 处理流程

1. **认证验证** - 检查 API Token 或 HMAC 签名
2. **请求验证** - 验证必需字段和约束（最多 100 项）
3. **去重检查** - 使用配置中的 `dedupe_window_days` 检查重复项
4. **评分** - 根据 `interests` 配置对项目进行评分
5. **筛选** - 过滤低于 `min_score` 的项目
6. **写入** - 将高分项目写入 Rote 笔记系统

## 配置示例

在 `configs/default.yaml` 中配置评分和筛选规则：

```yaml
interests:
  include:
    - "machine learning"
    - "artificial intelligence"
  exclude:
    - "advertisement"

ranking:
  min_score: 0.3          # 最低评分阈值 (0-1)
  dedupe_window_days: 7   # 去重时间窗口
  daily_limit: 50         # 每日处理上限

persona:
  name: "Traveler"        # 笔记作者名称
```

## 错误响应

| HTTP 状态 | 错误码 | 说明 |
|----------|--------|------|
| 400 | `invalid_json` | JSON 解析错误 |
| 400 | `invalid_request` | 请求体验证失败 |
| 401 | `unauthorized` | 认证失败 |
| 404 | `not_found` | 端点不存在 |
| 500 | `internal_error` | 服务器内部错误 |

## 使用示例

### Python

```python
import requests
import hmac
import hashlib
import json

def submit_items(items, source_name="my-source"):
    body = json.dumps({
        "source_name": source_name,
        "feed_items": items
    })
    
    # 使用 API Token
    headers = {
        "X-API-Token": "your-secret-token",
        "Content-Type": "application/json"
    }
    
    resp = requests.post(
        "http://localhost:8788/traveler/submit",
        data=body,
        headers=headers
    )
    return resp.json()

# 提交示例
result = submit_items([
    {
        "title": "New ML Paper",
        "url": "https://arxiv.org/abs/2401.12345",
        "summary": "A breakthrough in transformer architecture",
        "published_at": "2024-01-15T10:00:00Z"
    }
])

print(result)
```

### JavaScript/Node.js

```javascript
const crypto = require('crypto');

async function submitItems(items, sourceName = "my-source") {
  const body = JSON.stringify({
    source_name: sourceName,
    feed_items: items
  });
  
  // 使用 HMAC 签名
  const secret = process.env.TRAVELER_HMAC_SECRET;
  const signature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  const resp = await fetch('http://localhost:8788/traveler/submit', {
    method: 'POST',
    headers: {
      'X-Signature': signature,
      'Content-Type': 'application/json'
    },
    body
  });
  
  return resp.json();
}

// 提交示例
const result = await submitItems([
  {
    title: "New Article",
    url: "https://blog.example.com/post",
    summary: "Interesting insights",
    published_at: "2024-01-15T10:00:00Z"
  }
]);

console.log(result);
```

## 监控和日志

服务会输出处理日志：

```
✓ Traveler submit server listening on http://127.0.0.1:8788
  POST /traveler/submit - Submit feed items
  GET  /healthz       - Health check
```

调试模式可查看详细日志，包括认证结果和处理详情。
