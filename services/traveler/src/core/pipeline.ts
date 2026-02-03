import { fetchRss } from "./rss.ts";
import { isSeen, markSeen } from "./dedupe.ts";
import { openclawToolsInvoke } from "../utils/openclaw.ts";
import type { FeedItem, TravelerConfig } from "./types.ts";

/**
 * 简化版流程：直接把 RSS 内容发给 OpenClaw，让 AI 自己决定
 */
export async function runOnce(cfg: TravelerConfig): Promise<void> {
  // 1. 检查 OpenClaw 配置
  const gatewayUrl = (Deno.env.get("OPENCLAW_GATEWAY_URL") ?? "").trim();
  const gatewayToken = (Deno.env.get("OPENCLAW_GATEWAY_TOKEN") ?? "").trim();

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

  if (!newItems.length) {
    console.log(`📋 ${allItems.length} 条内容都已处理过（${dedupeDays} 天内）`);
    return;
  }

  console.log(`✨ 发现 ${newItems.length} 条新内容，交给 OpenClaw 处理...`);

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
    "下面是从各个订阅源获取的新内容（JSON 格式）：",
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
  const sessionLabel = `traveler-${new Date().toISOString().split("T")[0]}`;

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

    // 6. 标记所有内容为已处理
    for (const item of newItems) {
      markSeen(item.url);
    }

    console.log(`✅ 已将 ${newItems.length} 条内容发送给 OpenClaw`);
    console.log(`   会话标签：${sessionLabel}`);
  } catch (error) {
    console.error("❌ 发送到 OpenClaw 失败:", error);
    throw error;
  }
}
