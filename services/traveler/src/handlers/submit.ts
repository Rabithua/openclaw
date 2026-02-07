import type { FeedItem, TravelerConfig } from "../core/types.ts";
import { isSeen, markSeen } from "../core/dedupe.ts";
import { generateCuratorPrompt } from "../core/prompt.ts";
import { openclawToolsInvoke } from "../utils/openclaw.ts";
import { logError } from "../utils/logger.ts";

export type SubmitRequest = {
  source_name: string;
  feed_items: Array<{
    title: string;
    url: string;
    summary?: string;
    published_at?: string;
  }>;
};

export type SubmitResponse = {
  ok: boolean;
  processed?: number;
  rejected?: number;
  message?: string;
  error?: string;
};

export async function handleSubmit(
  req: SubmitRequest,
  cfg: TravelerConfig,
): Promise<SubmitResponse> {
  // 1. Validate request
  if (!req.source_name || !req.feed_items || !Array.isArray(req.feed_items)) {
    return {
      ok: false,
      error: "invalid_request: source_name and feed_items are required",
    };
  }

  if (req.feed_items.length === 0) {
    return {
      ok: false,
      error: "invalid_request: feed_items cannot be empty",
    };
  }

  // 2. Check OpenClaw configuration
  const gatewayUrl = (Deno.env.get("OPENCLAW_GATEWAY_URL") ?? "").trim();
  const gatewayToken = (Deno.env.get("OPENCLAW_GATEWAY_TOKEN") ?? "").trim();

  if (!gatewayUrl || !gatewayToken) {
    return {
      ok: false,
      error: "server_error: OPENCLAW_GATEWAY_URL or OPENCLAW_GATEWAY_TOKEN not configured",
    };
  }

  // 3. Transform and deduplicate
  const dedupeWindowDays = cfg.ranking?.dedupe_window_days ?? 7;

  const items: FeedItem[] = req.feed_items
    .filter((item) => item.title && item.url)
    .map((item) => ({
      source: req.source_name,
      title: item.title,
      url: item.url,
      summary: item.summary,
      publishedAt: item.published_at,
    }));

  const newItems: FeedItem[] = [];
  let rejected = 0;

  for (const item of items) {
    if (isSeen(item.url, dedupeWindowDays)) {
      rejected++;
      continue;
    }
    newItems.push(item);
  }

  if (newItems.length === 0) {
    return {
      ok: true,
      processed: 0,
      rejected,
      message: "All items already processed (duplicates)",
    };
  }

  // 4. Build task prompt

  const prompt = generateCuratorPrompt(cfg, newItems, req.source_name);

  // 5. Send to OpenClaw
  const sessionLabel = `traveler-submit-${req.source_name}-${Date.now()}`;

  try {
    await openclawToolsInvoke({
      gatewayUrl,
      gatewayToken,
      tool: "sessions_spawn",
      toolArgs: {
        label: sessionLabel,
        task: prompt,
        cleanup: "delete",
      },
    });

    // 6. Mark as processed
    for (const item of newItems) {
      markSeen(item.url);
    }

    return {
      ok: true,
      processed: newItems.length,
      rejected,
      message: `Sent ${newItems.length} items to OpenClaw for review`,
    };
  } catch (error) {
    logError("submit_forward_failed", { error: String(error) });
    return {
      ok: false,
      error: "failed_to_forward_to_openclaw",
    };
  }
}
