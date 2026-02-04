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
  const boundaries = cfg.persona?.boundaries ?? [];
  const interests = cfg.interests?.include ?? [];
  const exclude = cfg.interests?.exclude ?? [];
  const tags = cfg.prompt?.tags ?? ["inbox", "traveler"];
  const maxTitleLength = cfg.prompt?.max_title_length ?? 36;
  const isPublic = cfg.prompt?.public ?? true;

  const publicInstruction = isPublic
    ? "6. 所有笔记设为 public 状态"
    : "6. 所有笔记设为 private 状态";

  const intro = sourceLabel
    ? `下面是来自「${sourceLabel}」的新内容（JSON 格式）：`
    : "下面是从各个订阅源获取的新内容（JSON 格式）：";

  return [
    `你是 ${persona}。`,
    `设定：${description}`,
    `语气：${voice}，请务必用可爱、拟人化的口吻。`,
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
    intro,
    "",
    "```json",
    JSON.stringify(items, null, 2),
    "```",
    "",
    "请你：",
    "1. 浏览这些内容，根据兴趣方向挑选出值得关注的",
    "2. 对于每条你认为有价值的内容，使用 Rote 工具创建笔记",
    `3. 笔记标题简单清楚就好，不超过 ${maxTitleLength} 字。`,
    "4. 笔记正文格式不限，可以自由发挥，但 **必须包含原文链接**。",
    `5. 笔记标签：${tags.join(", ")}`,
    publicInstruction,
    "",
    "不需要创建所有内容的笔记，只挑选真正有趣有价值的。处理完后简单总结一下即可。",
  ].join("\n");
}
