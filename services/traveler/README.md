# Traveler - AI 驱动的 RSS 订阅助手

简单、智能的 RSS 订阅管理工具，完全由 OpenClaw AI 决策。

## 核心理念

**让 AI 做决定，不写复杂规则**

传统的 RSS
阅读器需要你设置复杂的过滤规则、评分算法、关键词匹配...这些都太麻烦了。

Traveler 的做法很简单：

1. 抓取 RSS 订阅源
2. 把所有内容发给 OpenClaw
3. AI 自己看、自己选、自己发布到 Rote

## 快速开始

### 1. 前置要求

- 已部署 OpenClaw（本地或远程）
- 拥有 Rote 账号和 OpenKey

### 2. 配置

```bash
cd services/traveler

# 复制环境变量模板
cp .env.example .env

# 编辑 .env，必须配置：
# - OPENCLAW_GATEWAY_URL（OpenClaw 的地址）
# - OPENCLAW_GATEWAY_TOKEN（OpenClaw 的访问令牌）
# - ROTE_API_BASE（Rote API 地址）
# - ROTE_OPENKEY（你的 Rote OpenKey）
```

### 3. 添加订阅源

编辑 `configs/default.yaml`：

```yaml
sources:
  - type: rss
    name: "Hacker News"
    url: "https://hnrss.org/frontpage"

  - type: rss
    name: "阮一峰的网络日志"
    url: "https://www.ruanyifeng.com/blog/atom.xml"
```

### 4. 运行

**方式 1：使用 Docker（推荐）**

```bash
# 启动服务器模式
docker-compose up -d

# 查看日志
docker-compose logs -f

# 手动触发一次抓取
docker-compose exec traveler deno task run
```

**方式 2：直接运行**

```bash
# 单次运行
deno task run

# 或启动 HTTP 服务器
deno task server
```

详细的 Docker 使用说明请查看 [DOCKER.md](DOCKER.md)

## 工作流程

```
RSS 订阅源
    ↓
抓取新内容
    ↓
去重（7 天内避免重复）
    ↓
发送给 OpenClaw AI
    ↓
AI 浏览、筛选
    ↓
AI 将感兴趣的内容写入 Rote 笔记
```

## 配置说明

### persona（个性设置）

定义 AI 助手的身份和行为准则：

```yaml
persona:
  name: Traveler # AI 的名字
  voice: "好奇、简洁、有见地" # 语气风格
  boundaries: # 行为准则
    - "区分事实和观点"
    - "始终包含原文链接"
```

### interests（兴趣偏好）

帮助 AI 了解你的兴趣方向：

```yaml
interests:
  include: # 感兴趣的主题
    - "开源项目"
    - "AI 工具"
    - "系统设计"
  exclude: # 不感兴趣的主题
    - "明星八卦"
    - "标题党"
```

### output（输出设置）

```yaml
output:
  rote:
    tags: ["inbox", "traveler"] # 发布到 Rote 时的标签
```

## HTTP API（可选）

如果启动了服务器模式（`deno task server`），可以通过 API 主动提交内容：

### POST /traveler/submit

```bash
curl -X POST http://127.0.0.1:8788/traveler/submit \
  -H "X-API-Token: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "我的收藏",
    "feed_items": [
      {
        "title": "有趣的文章",
        "url": "https://example.com/article",
        "summary": "这是一篇很棒的文章...",
        "published_at": "2024-01-01T00:00:00Z"
      }
    ]
  }'
```

详见 [SUBMIT_API.md](docs/SUBMIT_API.md)

## 定时运行

使用 cron 定时执行：

```bash
# 每小时运行一次
0 * * * * cd /path/to/openclaw/services/traveler && deno task run

# 或使用 systemd timer、launchd 等
```

## 为什么不用传统的评分系统？

传统方法的问题：

- 需要手写复杂的关键词匹配规则
- 规则难以维护，容易过时
- 无法理解上下文和语义
- 误判率高

AI 驱动的好处：

- AI 能理解文章的真实内容和价值
- 自动适应新话题和新领域
- 不需要维护规则，只需告诉它你的兴趣
- 决策更智能、更灵活

## 技术栈

- **Deno** - TypeScript 运行时
- **OpenClaw** - AI 决策引擎
- **Rote** - 笔记系统

## License

个人项目，如需重用请自行添加许可证。
