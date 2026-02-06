import { fetchRss } from "./rss.ts";
import { isSeen, markSeen } from "./dedupe.ts";
import { openclawToolsInvoke } from "../utils/openclaw.ts";
import type { FeedItem, TravelerConfig } from "./types.ts";
import { generateCuratorPrompt } from "./prompt.ts";

/**
 * Simplified pipeline: Send RSS content directly to OpenClaw and let AI decide
 */
export async function runOnce(cfg: TravelerConfig): Promise<void> {
  // 1. Check OpenClaw configuration
  const gatewayUrl = (Deno.env.get("OPENCLAW_GATEWAY_URL") ?? "").trim();
  const gatewayToken = (Deno.env.get("OPENCLAW_GATEWAY_TOKEN") ?? "").trim();
  const roteApiBase = (Deno.env.get("ROTE_API_BASE") ?? "").trim();
  const roteOpenKey = (Deno.env.get("ROTE_OPENKEY") ?? "").trim();

  if (!gatewayUrl || !gatewayToken) {
    console.error("❌ Missing OPENCLAW_GATEWAY_URL or OPENCLAW_GATEWAY_TOKEN");
    console.error("   Traveler now fully relies on OpenClaw, please configure these environment variables");
    return;
  }

  // 2. Fetch all subscription sources
  const sources = cfg.sources ?? [];
  const allItems: FeedItem[] = [];

  for (const src of sources) {
    if (src.type === "rss") {
      const items = await fetchRss(src.url, src.name ?? "rss");
      allItems.push(...items);
      console.log(`📡 Fetched ${items.length} items from ${src.name}`);
    }
  }

  if (!allItems.length) {
    console.log("📭 No new content");
    return;
  }

  // 3. Deduplicate (avoid duplicate submissions)
  const dedupeDays = cfg.ranking?.dedupe_window_days ?? 7;
  const newItems = allItems.filter((i) => !isSeen(i.url, dedupeDays));
  const batchLimit = cfg.ranking?.batch_limit ?? 5;
  const sendItems = newItems.slice(0, batchLimit);

  if (!newItems.length) {
    console.log(`📋 All ${allItems.length} items have been processed (within ${dedupeDays} days)`);
    return;
  }

  console.log(`✨ Found ${newItems.length} new items, forwarding to OpenClaw...`);

  // 4. Build task prompt

  const prompt = generateCuratorPrompt(cfg, sendItems);

  // 5. Send to OpenClaw
  const sessionLabel = `traveler-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;

  try {
    await openclawToolsInvoke({
      gatewayUrl,
      gatewayToken,
      tool: "sessions_spawn",
      toolArgs: {
        label: sessionLabel,
        task: `${prompt}\n\nROTE_API_BASE=${roteApiBase}\nROTE_OPENKEY=${roteOpenKey}`,
        cleanup: "delete",
      },
    });

    // 6. Mark all items as processed
    for (const item of sendItems) {
      markSeen(item.url);
    }

    console.log(`✅ Sent ${sendItems.length} items to OpenClaw`);
    console.log(`   Session label: ${sessionLabel}`);
  } catch (error) {
    console.error("❌ Failed to send to OpenClaw:", error);
    throw error;
  }
}
