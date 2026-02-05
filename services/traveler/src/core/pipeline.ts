import { fetchRss } from "./rss.ts";
import { isSeen, markSeen } from "./dedupe.ts";
import { openclawToolsInvoke } from "../utils/openclaw.ts";
import type { FeedItem, TravelerConfig } from "./types.ts";
import { generateCuratorPrompt } from "./prompt.ts";

/**
 * 简化版流程：直接把 RSS 内容发给 OpenClaw，让 AI 自己决定
 */
export async function runOnce(cfg: TravelerConfig): Promise<void> {
  // 1. 检查 OpenClaw 配置
  const gatewayUrl = (Deno.env.get("OPENCLAW_GATEWAY_URL") ?? "").trim();
  const gatewayToken = (Deno.env.get("OPENCLAW_GATEWAY_TOKEN") ?? "").trim();
  const roteApiBase = (Deno.env.get("ROTE_API_BASE") ?? "").trim();
  const roteOpenKey = (Deno.env.get("ROTE_OPENKEY") ?? "").trim();

  if (!gatewayUrl || !gatewayToken) {
    console.error("❌ 缺少 OPENCLAW_GATEWAY_URL 或 OPENCLAW_GATEWAY_TOKEN");
    console.error("   现在 Traveler 完全依赖 OpenClaw，请配置这两个环境变量");
    return;
  }

  // 2. 抓取所有订阅源
  const sources = cfg.sources ?? [];
  const allItems: FeedItem[] = [];

  for (const src of sources) {
    if (src.type === "rss") {
      const items = await fetchRss(src.url, src.name ?? "rss");
      allItems.push(...items);
      console.log(`📡 从 ${src.name} 获取了 ${items.length} 条`);
    }
  }

  if (!allItems.length) {
    console.log("📭 没有新内容");
    return;
  }

  // 3. 去重（避免重复发送）
  const dedupeDays = cfg.ranking?.dedupe_window_days ?? 7;
  const newItems = allItems.filter((i) => !isSeen(i.url, dedupeDays));
  const batchLimit = cfg.ranking?.batch_limit ?? 5;
  const sendItems = newItems.slice(0, batchLimit);

  if (!newItems.length) {
    console.log(`📋 ${allItems.length} 条内容都已处理过（${dedupeDays} 天内）`);
    return;
  }

  console.log(`✨ 发现 ${newItems.length} 条新内容，交给 OpenClaw 处理...`);

  // 4. 构建任务提示词

  const prompt = generateCuratorPrompt(cfg, sendItems);

  // 5. 发送给 OpenClaw
  const sessionLabel = `traveler-${new Date().toISOString().split("T")[0]}`;

  try {
    await openclawToolsInvoke({
      gatewayUrl,
      gatewayToken,
      tool: "sessions_spawn",
      toolArgs: {
        label: sessionLabel,
        task: prompt,
        cleanup: "delete",
        env: {
          ROTE_API_BASE: roteApiBase,
          ROTE_API_KEY: roteOpenKey,
        },
      },
    });

    // 6. 标记所有内容为已处理
    for (const item of sendItems) {
      markSeen(item.url);
    }

    console.log(`✅ 已将 ${sendItems.length} 条内容发送给 OpenClaw`);
    console.log(`   会话标签：${sessionLabel}`);
  } catch (error) {
    console.error("❌ 发送到 OpenClaw 失败:", error);
    throw error;
  }
}
