import type { FeedItem, TravelerConfig } from "../core/types.ts";
import { isSeen, markSeen } from "../core/dedupe.ts";
import { openclawToolsInvoke } from "../utils/openclaw.ts";

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
  // 1. 验证请求
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

  if (req.feed_items.length > 100) {
    return {
      ok: false,
      error: "invalid_request: maximum 100 items per request",
    };
  }

  // 2. 检查 OpenClaw 配置
  const gatewayUrl = (Deno.env.get("OPENCLAW_GATEWAY_URL") ?? "").trim();
  const gatewayToken = (Deno.env.get("OPENCLAW_GATEWAY_TOKEN") ?? "").trim();

  if (!gatewayUrl || !gatewayToken) {
    return {
      ok: false,
      error:
        "server_error: OPENCLAW_GATEWAY_URL or OPENCLAW_GATEWAY_TOKEN not configured",
    };
  }

  // 3. 转换并去重
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

  // 4. 构建任务提示词
  const persona = cfg.persona?.name ?? "Traveler";
  const voice = cfg.persona?.voice ?? "curious, concise";
  const boundaries = cfg.persona?.boundaries ?? [];
  const interests = cfg.interests?.include ?? [];
  const exclude = cfg.interests?.exclude ?? [];
  const tags = cfg.output?.rote?.tags ?? ["inbox", "traveler"];

  const prompt = [
    `你是 ${persona}，一个智能信息策展助手。`,
    `语气：${voice}`,
    "",
    "你的原则：",
    ...boundaries.map((b) => `- ${b}`),
    "",
    "兴趣方向：",
    ...interests.map((i) => `- ${i}`),
    "",
    exclude.length ? "不感兴趣：" : "",
    ...exclude.map((e) => `- ${e}`),
    "",
    "---",
    "",
    `下面是来自「${req.source_name}」的新内容（JSON 格式）：`,
    "",
    "```json",
    JSON.stringify(newItems, null, 2),
    "```",
    "",
    "请你：",
    "1. 浏览这些内容，根据兴趣方向挑选出值得关注的",
    "2. 对于每条你认为有价值的内容，使用 Rote 工具创建笔记",
    "3. 笔记标题格式：[来源] 标题（不超过 200 字符）",
    "4. 笔记正文包含：原文链接、发布时间、摘要、你的推荐理由",
    `5. 笔记标签：${tags.join(", ")}`,
    "6. 所有笔记设为 private 状态",
    "",
    "不需要创建所有内容的笔记，只挑选真正有价值的。处理完后简单总结一下即可。",
  ].join("\n");

  // 5. 发送给 OpenClaw
  const sessionLabel = `traveler-submit-${req.source_name}-${Date.now()}`;

  try {
    await openclawToolsInvoke({
      gatewayUrl,
      gatewayToken,
      tool: "sessions",
      action: "spawn",
      toolArgs: {
        label: sessionLabel,
        task: prompt,
      },
    });

    // 6. 标记为已处理
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
    console.error("Failed to send to OpenClaw:", error);
    return {
      ok: false,
      error: "failed_to_forward_to_openclaw",
    };
  }
}
