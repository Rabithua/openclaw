# Traveler 信息源提交接口 - 实现总结

## 概述

已成功为 OpenClaw Traveler 服务添加了一个 HTTP 接口
(`/traveler/submit`)，允许用户主动提交信息源项。该接口包含简单但有效的安全机制、智能处理流程，以及与现有系统的完整集成。

## 新增文件清单

### 核心服务文件

| 文件                                             | 作用                                 |
| ------------------------------------------------ | ------------------------------------ |
| [src/server.ts](src/server.ts)                   | 主 HTTP 服务器，处理请求路由和认证   |
| [src/handlers/submit.ts](src/handlers/submit.ts) | 提交请求处理逻辑（验证、评分、写入） |
| [src/utils/auth.ts](src/utils/auth.ts)           | 认证工具（API Token、HMAC-SHA256）   |
| [src/utils/http.ts](src/utils/http.ts)           | HTTP 工具函数（JSON 序列化等）       |

### 文档文件

| 文件                               | 内容                                        |
| ---------------------------------- | ------------------------------------------- |
| [SUBMIT_API.md](SUBMIT_API.md)     | 完整的 API 文档，包含所有端点、字段、错误码 |
| [SUBMIT_SETUP.md](SUBMIT_SETUP.md) | 快速开始指南、配置说明、集成示例            |
| [.env.example](.env.example)       | 已更新，添加新的环境变量说明                |

### 测试和工具

| 文件                                                       | 用途                            |
| ---------------------------------------------------------- | ------------------------------- |
| [tests/test-submit.sh](tests/test-submit.sh)               | 完整的测试套件（bash + python） |
| [tests/test-curl-examples.sh](tests/test-curl-examples.sh) | 简单的 curl 测试示例            |

### 配置更新

| 文件                   | 改动                 |
| ---------------------- | -------------------- |
| [deno.json](deno.json) | 添加 `server` task   |
| [mod.ts](mod.ts)       | 导出新的处理器和类型 |

## 核心功能

### 1. HTTP 服务器 (`src/server.ts`)

```
GET  /healthz  → 健康检查
POST /traveler/submit   → 提交信息源项（需认证）
```

**环境变量**：

- `TRAVELER_PORT` (默认 8788)
- `TRAVELER_API_TOKEN` (API 认证 token)
- `TRAVELER_HMAC_SECRET` (可选，HMAC 签名密钥)
- `TRAVELER_CONFIG` (默认 configs/default.yaml)

### 2. 认证机制 (`src/utils/auth.ts`)

支持两种认证方式：

**方式 1：API Token**

```
Header: X-API-Token: <token>
```

- 简单直接
- 适合脚本和服务

**方式 2：HMAC-SHA256 签名**

```
Header: X-Signature: sha256=<hex>
```

- 更安全，防止篡改
- 适合 webhook

### 3. 处理流程 (`src/handlers/submit.ts`)

```
请求验证 → 去重检查 → 评分 → 筛选 → 写入 Rote
```

**关键步骤**：

1. 验证必需字段（source_name, feed_items）
2. 限制单次请求最多 100 项
3. 检查 7 天内是否重复（可配置）
4. 根据兴趣标签评分（0-1）
5. 过滤低于最小分数的项目（默认 0.3）
6. 将高分项目写入 Rote 笔记系统

## 安全特性

### 请求级别

- ✓ 完整的认证验证（Token 或 HMAC）
- ✓ 请求体大小限制（100 项/请求）
- ✓ JSON 解析异常处理
- ✓ 详细的错误码（不泄露敏感信息）

### 处理级别

- ✓ 自动去重（7 天时间窗口）
- ✓ 兴趣过滤（黑名单/白名单）
- ✓ 评分机制（防止垃圾内容）
- ✓ URL 格式验证

## 使用示例

### 最简单的用法

```bash
# 1. 启动服务
export TRAVELER_API_TOKEN="my-secret"
deno task server

# 2. 提交信息
curl -X POST http://localhost:8788/traveler/submit \
  -H "X-API-Token: my-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "my-blog",
    "feed_items": [{
      "title": "Article",
      "url": "https://example.com/article"
    }]
  }'
```

### Python 集成

```python
import requests

url = "http://localhost:8788/traveler/submit"
headers = {"X-API-Token": "my-secret"}
data = {
    "source_name": "python-app",
    "feed_items": [
        {
            "title": "New Article",
            "url": "https://example.com/article",
            "summary": "Optional summary"
        }
    ]
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
# {"ok": true, "processed": 1, "rejected": 0}
```

## 配置示例

在 `configs/default.yaml` 中：

```yaml
interests:
  include: ["machine learning", "AI"]
  exclude: ["advertisement"]

ranking:
  min_score: 0.3 # 最低评分
  dedupe_window_days: 7 # 去重窗口
  daily_limit: 50 # 每日上限

output:
  rote:
    tags: ["inbox", "traveler"]
```

## API 响应示例

**成功 (200)**

```json
{
  "ok": true,
  "processed": 3,
  "rejected": 1,
  "message": "Processed 3 item(s), rejected 1 item(s)"
}
```

**错误 (401)**

```json
{
  "ok": false,
  "error": "unauthorized: invalid or missing credentials"
}
```

**错误 (400)**

```json
{
  "ok": false,
  "error": "invalid_request: feed_items cannot be empty"
}
```

## 架构集成

```
┌─────────────────────────┐
│  外部应用/脚本/Webhook  │
└────────────┬────────────┘
             │
             ↓ POST /traveler/submit
    ┌────────────────────┐
    │ Traveler Server    │
    │ (HTTP)             │
    └────────┬───────────┘
             │
             ├→ 认证 (Token/HMAC)
             ├→ 验证请求
             ├→ 去重检查
             ├→ 评分过滤
             └→ 写入 Rote API
                    │
                    ↓
            ┌──────────────┐
            │ Rote Notes   │
            │ 笔记系统     │
            └──────────────┘
```

## 测试步骤

### 快速测试

```bash
# 启动服务（一个终端）
export TRAVELER_API_TOKEN="test-token"
deno task server

# 运行测试（另一个终端）
API_TOKEN="test-token" bash tests/test-curl-examples.sh
```

### 完整测试

```bash
API_TOKEN="test-token" bash tests/test-submit.sh
```

### 单个端点测试

```bash
# 健康检查
curl http://localhost:8788/healthz

# 提交单个项目
curl -X POST http://localhost:8788/traveler/submit \
  -H "X-API-Token: test-token" \
  -H "Content-Type: application/json" \
  -d '{"source_name":"test","feed_items":[{"title":"Test","url":"https://example.com"}]}'
```

## 环境变量配置

创建 `.env` 文件：

```bash
# 必需
TRAVELER_API_TOKEN=your-secret-token

# 可选
TRAVELER_HMAC_SECRET=your-hmac-secret
TRAVELER_PORT=8788
TRAVELER_CONFIG=configs/default.yaml

# Rote 集成（已有）
ROTE_API_BASE=https://api.rote.ink/v2/api
ROTE_OPENKEY=your-openkey
```

## 文件大小和复杂度

| 文件                   | 行数 | 复杂度            |
| ---------------------- | ---- | ----------------- |
| src/server.ts          | ~92  | 简单（HTTP 路由） |
| src/handlers/submit.ts | ~154 | 中等（处理逻辑）  |
| src/utils/auth.ts      | ~49  | 简单（认证）      |
| src/utils/http.ts      | ~13  | 简单（工具）      |

总计：~308 行代码，包含完整的错误处理和文档

## 扩展可能性

已设计为易于扩展：

- [ ] 支持其他认证方式（OAuth、JWT）
- [ ] 实现请求队列和异步处理
- [ ] 添加速率限制
- [ ] 实现 WebSocket 实时通知
- [ ] 支持批量查询提交状态
- [ ] 添加审计日志
- [ ] 集成 webhook 重试机制

## 注意事项

1. **API Token 安全**：不要在代码中硬编码 token，使用环境变量
2. **HMAC 签名**：确保密钥的保密性，采用加密传输
3. **配置 dedupe_window_days**：根据需求调整去重窗口
4. **min_score 阈值**：调整评分阈值以控制内容质量
5. **daily_limit**：根据 Rote 容量设置日处理限制

## 快速参考

```bash
# 启动
deno task server

# 格式检查
deno task fmt

# 类型检查
deno task check

# 提交数据
curl -X POST http://localhost:8788/traveler/submit \
  -H "X-API-Token: $TRAVELER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## 文档索引

- [SUBMIT_API.md](SUBMIT_API.md) - API 参考文档
- [SUBMIT_SETUP.md](SUBMIT_SETUP.md) - 安装和配置指南
- [tests/test-submit.sh](tests/test-submit.sh) - 完整测试套件
- [tests/test-curl-examples.sh](tests/test-curl-examples.sh) - curl 示例

---

**版本**：1.0.0\
**创建日期**：2024年\
**状态**：生产就绪 ✓
