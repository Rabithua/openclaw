#!/bin/bash

# 简单的 curl 测试命令集合

# 设置基础变量
API_URL="http://localhost:8788"
API_TOKEN="your-secret-token"

echo "=== Traveler Submit API 简单测试 ==="
echo ""

# 1. 健康检查
echo "1. 健康检查"
echo "命令: curl -s $API_URL/healthz | jq"
curl -s "$API_URL/healthz" | jq
echo ""

# 2. 提交单个项目（最简单的情况）
echo "2. 提交单个项目"
echo "命令: POST /traveler/submit with token"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "test-blog",
    "feed_items": [
      {
        "title": "Hello Traveler",
        "url": "https://example.com/hello",
        "summary": "First test article"
      }
    ]
  }' | jq
echo ""

# 3. 提交多个项目（包括会被过滤的）
echo "3. 提交多个项目"
echo "命令: POST /traveler/submit with multiple items"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "tech-news",
    "feed_items": [
      {
        "title": "AI Breakthrough",
        "url": "https://example.com/ai",
        "summary": "New developments in artificial intelligence",
        "published_at": "2024-01-15T10:00:00Z"
      },
      {
        "title": "Web Framework Updates",
        "url": "https://example.com/framework",
        "summary": "Latest updates to popular web frameworks",
        "published_at": "2024-01-15T11:00:00Z"
      }
    ]
  }' | jq
echo ""

# 4. 未授权请求（无 token）
echo "4. 未授权请求（应该返回 401）"
echo "命令: POST /traveler/submit without token"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "Content-Type: application/json" \
  -d '{"source_name":"test","feed_items":[{"title":"Test","url":"https://example.com/test"}]}' | jq
echo ""

# 5. 错误的 token
echo "5. 错误的 Token（应该返回 401）"
echo "命令: POST /traveler/submit with wrong token"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"source_name":"test","feed_items":[{"title":"Test","url":"https://example.com/test"}]}' | jq
echo ""

# 6. 缺少必需字段
echo "6. 缺少必需字段（应该返回 400）"
echo "命令: POST /traveler/submit missing source_name"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feed_items":[{"title":"Test","url":"https://example.com/test"}]}' | jq
echo ""

# 7. 不存在的端点
echo "7. 不存在的端点（应该返回 404）"
echo "命令: GET /notfound"
curl -s -X GET "$API_URL/notfound" | jq
echo ""

echo "=== 测试完成 ==="
