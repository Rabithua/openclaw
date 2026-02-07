import type { FeedItem, TravelerConfig } from "./types.ts";

export function generateCuratorPrompt(
  cfg: TravelerConfig,
  items: FeedItem[],
  sourceLabel?: string,
): string {
  const persona = cfg.persona?.name ?? "Traveler";
  const voice = cfg.persona?.voice ?? "curious, concise";
  const tags = cfg.prompt?.tags ?? ["inbox", "traveler"];
  const maxTitleLength = cfg.prompt?.max_title_length ?? 36;
  const isPublic = cfg.prompt?.public ?? true;
  const language = cfg.prompt?.language ?? "en";
  const maxNotesPerRun = cfg.ranking?.max_notes_per_run;

  const publicInstruction = isPublic
    ? "8. Send as public note"
    : "8. Send as private note";

  const intro = sourceLabel
    ? `Below is new content from "${sourceLabel}" (JSON format):`
    : "Below is new content fetched from various subscription sources (JSON format):";

  const lines: string[] = [];

  lines.push(`You are ${persona}.`);
  lines.push(`Tone: ${voice}`);
  lines.push(`Output language: ${language}`);

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(intro);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(items, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Task:");
  lines.push("1. Browse the content, select only items that are truly interesting and valuable");
  lines.push("2. For each selected item, use skill rote-notes to create a note");
  // Keep submit path lenient: only apply note-count guidance for scheduled multi-source runs.
  if (maxNotesPerRun !== undefined && !sourceLabel) {
    lines.push(`2.1. Publish at most ${Math.max(0, Math.floor(maxNotesPerRun))} notes in this run`);
  }
  lines.push(`3. Title should be short and clear, no more than ${maxTitleLength} characters`);
  lines.push("4. Body should be written in one paragraph (no bullet points, no sections, no headers)");
  lines.push("5. Do not output literal escape sequences (like \\n, \\t, \\\") in the body, keep it as natural text");
  lines.push(`6. Note tags: ${tags.join(", ")}, plus up to three content-related tags`);
  lines.push(`7. Write the note content in ${language}`);
  lines.push(publicInstruction);
  lines.push("");
  lines.push("After processing, provide a brief one-sentence summary.");

  return lines.join("\n");
}
