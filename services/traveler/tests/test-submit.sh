#!/bin/bash

# Traveler Submit API Test Script
# 用于测试 /traveler/submit 端点的 bash 脚本

set -e

API_URL="${API_URL:-http://localhost:8788}"
API_TOKEN="${API_TOKEN:-your-secret-token}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Traveler Submit API Tests ===${NC}\n"

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s -X GET "$API_URL/healthz" | jq . || echo "Health check failed"
echo -e ""

# Test 2: Missing credentials
echo -e "${YELLOW}Test 2: Missing Credentials (should return 401)${NC}"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "test",
    "feed_items": []
  }' | jq .
echo -e ""

# Test 3: Invalid JSON
echo -e "${YELLOW}Test 3: Invalid JSON (should return 400)${NC}"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d 'invalid json' | jq .
echo -e ""

# Test 4: Missing required fields
echo -e "${YELLOW}Test 4: Missing Required Fields (should return 400)${NC}"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "test"
  }' | jq .
echo -e ""

# Test 5: Empty feed_items
echo -e "${YELLOW}Test 5: Empty Feed Items (should return 400)${NC}"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "test",
    "feed_items": []
  }' | jq .
echo -e ""

# Test 6: Valid request with single item
echo -e "${YELLOW}Test 6: Valid Request with Single Item${NC}"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "test-source",
    "feed_items": [
      {
        "title": "Test Article 1",
        "url": "https://example.com/article1",
        "summary": "This is a test article about machine learning",
        "published_at": "2024-01-15T10:00:00Z"
      }
    ]
  }' | jq .
echo -e ""

# Test 7: Multiple items
echo -e "${YELLOW}Test 7: Multiple Items${NC}"
curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-API-Token: $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "test-blog",
    "feed_items": [
      {
        "title": "AI Breakthrough",
        "url": "https://blog.example.com/ai",
        "summary": "New developments in artificial intelligence and machine learning"
      },
      {
        "title": "Web Development Tips",
        "url": "https://blog.example.com/web",
        "summary": "Best practices for modern web development with TypeScript"
      },
      {
        "title": "Advertisement",
        "url": "https://ads.example.com/promo",
        "summary": "Buy our product now at 50% off"
      }
    ]
  }' | jq .
echo -e ""

# Test 8: Exceeding max items (101 items, should return 400)
echo -e "${YELLOW}Test 8: Exceeding Max Items (should return 400)${NC}"
python3 << 'EOF'
import requests
import json

items = [
    {
        "title": f"Article {i}",
        "url": f"https://example.com/article-{i}",
        "summary": f"Test article number {i}"
    }
    for i in range(101)
]

response = requests.post(
    "http://localhost:8788/traveler/submit",
    headers={
        "X-API-Token": "your-secret-token",
        "Content-Type": "application/json"
    },
    json={
        "source_name": "test",
        "feed_items": items
    }
)

print(json.dumps(response.json(), indent=2))
EOF
echo -e ""

# Test 9: HMAC Signature (requires TRAVELER_HMAC_SECRET to be set)
echo -e "${YELLOW}Test 9: HMAC Signature Authentication${NC}"
BODY='{"source_name":"hmac-test","feed_items":[{"title":"Test","url":"https://example.com/test"}]}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "test-secret" | sed 's/^.* /sha256=/')

curl -s -X POST "$API_URL/traveler/submit" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY" | jq .
echo -e ""

echo -e "${GREEN}✓ Tests completed!${NC}"
