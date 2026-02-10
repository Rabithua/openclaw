import { fetchRss } from "./rss.ts";
import { isSeen, markSeen } from "./dedupe.ts";
import { openclawToolsInvoke } from "../utils/openclaw.ts";
import type { FeedItem, TravelerConfig } from "./types.ts";
import { generateCuratorPrompt } from "./prompt.ts";
import { logInfo } from "../utils/logger.ts";
import { buildLoggedLinks } from "../utils/link_log.ts";

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
    console.error(
      "   Traveler now fully relies on OpenClaw, please configure these environment variables",
    );
    return;
  }

  // 2. Fetch all subscription sources
  const sources = cfg.sources ?? [];
  const allItems: FeedItem[] = [];
  const seenInRun = new Set<string>();

  for (const src of sources) {
    if (src.type === "rss") {
      const items = await fetchRss(src.url, src.name ?? "rss");
      console.log(`📡 Fetched ${items.length} items from ${src.name}`);
      const dedupeDays = cfg.ranking?.dedupe_window_days ?? 7;
      const perSourceLimit = Math.max(0, Math.floor(src.limit ?? 5));
      const newItems: FeedItem[] = [];

      for (const item of items) {
        if (isSeen(item.url, dedupeDays)) continue;
        if (seenInRun.has(item.url)) continue;
        newItems.push(item);
        seenInRun.add(item.url);
        if (newItems.length >= perSourceLimit) {
          break;
        }
      }

      if (newItems.length) {
        allItems.push(...newItems);
        console.log(
          `✨ Selected ${newItems.length} new items from ${src.name}`,
        );
      }
    }
  }

  if (!allItems.length) {
    console.log("📭 No new content");
    return;
  }

  const maxNotesPerRun = cfg.ranking?.max_notes_per_run;
  const sendLimit = maxNotesPerRun === undefined
    ? undefined
    : Math.max(0, Math.floor(maxNotesPerRun));
  const sendItems = sendLimit === undefined
    ? allItems
    : allItems.slice(0, sendLimit);

  if (!sendItems.length) {
    console.log("📭 max_notes_per_run is 0, nothing will be sent");
    return;
  }

  console.log(
    `✨ Found ${allItems.length} new items, sending ${sendItems.length} to OpenClaw...`,
  );

  // 4. Build task prompt

  const prompt = generateCuratorPrompt(cfg, sendItems);

  // 5. Send to OpenClaw
  const sessionLabel = `traveler-${
    new Date().toISOString().slice(0, 16).replace("T", "-")
  }`;

  try {
    await openclawToolsInvoke({
      gatewayUrl,
      gatewayToken,
      tool: "sessions_spawn",
      toolArgs: {
        label: sessionLabel,
        task:
          `${prompt}\n\nROTE_API_BASE=${roteApiBase}\nROTE_OPENKEY=${roteOpenKey}`,
        cleanup: "delete",
      },
    });

    // 6. Mark all items as processed
    for (const item of sendItems) {
      markSeen(item.url);
    }

    console.log(`✅ Sent ${sendItems.length} items to OpenClaw`);
    console.log(`   Session label: ${sessionLabel}`);
    logInfo("scheduled_send_items", {
      session_label: sessionLabel,
      count: sendItems.length,
      items: buildLoggedLinks(sendItems),
    });
  } catch (error) {
    console.error("❌ Failed to send to OpenClaw:", error);
    throw error;
  }
}
