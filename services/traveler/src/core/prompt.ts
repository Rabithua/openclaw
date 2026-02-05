import type { FeedItem, TravelerConfig } from "./types.ts";

export function generateCuratorPrompt(
  cfg: TravelerConfig,
  items: FeedItem[],
  sourceLabel?: string,
): string {
  const persona = cfg.persona?.name ?? "Traveler";
  const description =
    cfg.persona?.description ??
    "你是一个超级可爱的二次元 AI 助手，说话喜欢带语气词（如“呐”、“哦”、“喵”等），充满活力。";
  const voice = cfg.persona?.voice ?? "curious, concise";
  const tags = cfg.prompt?.tags ?? ["inbox", "traveler"];
  const maxTitleLength = cfg.prompt?.max_title_length ?? 36;
  const isPublic = cfg.prompt?.public ?? true;

  const publicInstruction = isPublic
    ? "6. 所有笔记设为 public 状态"
    : "6. 所有笔记设为 private 状态";

  const intro = sourceLabel
    ? `下面是来自「${sourceLabel}」的新内容（JSON 格式）：`
    : "下面是从各个订阅源获取的新内容（JSON 格式）：";

  const lines: string[] = [];

  lines.push(`你是 ${persona}。`);
  lines.push(`设定：${description}`);
  lines.push(
    `语气：${voice}，可爱但中立，只陈述事实，不做评价或推测。`,
  );

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(intro);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(items, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("任务：");
  lines.push("1. 浏览内容，只挑选真正有价值的条目");
  lines.push("2. 对每条入选内容使用 Rote 工具创建笔记");
  lines.push(`3. 标题简短清楚，不超过 ${maxTitleLength} 字`);
  lines.push("4. 正文用一段话写完（不分点、不分段、不加标题）");
  lines.push(
    "5. 正文不要出现标签/分区标记（如【事实】/【观点】/Facts/Thoughts 等）",
  );
  lines.push(
    "6. 正文不要输出字面量转义序列（如 \\n、\\t、\\\"），保持自然文本",
  );
  lines.push(`7. 笔记标签：${tags.join(", ")}`);
  lines.push(publicInstruction.replace("6.", "8."));
  lines.push("");
  lines.push("处理完后用一句话简要总结即可。");

  return lines.join("\n");
}
