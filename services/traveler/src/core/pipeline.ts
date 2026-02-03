import { fetchRss } from "./rss.ts";
import { isSeen, markSeen } from "./dedupe.ts";
import { createRoteNote } from "./rote.ts";
import type { FeedItem, SelectedItem, TravelerConfig } from "./types.ts";

function includesAny(hay: string, needles: string[]): boolean {
  const h = hay.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function scoreItem(item: FeedItem, cfg: TravelerConfig): SelectedItem {
  const include = cfg.interests?.include ?? [];
  const exclude = cfg.interests?.exclude ?? [];

  const text = `${item.title}\n${item.summary ?? ""}`.trim();

  const reasons: string[] = [];
  let score = 0.5;

  if (include.length && includesAny(text, include)) {
    score += 0.25;
    reasons.push("matches_interests");
  }

  if (exclude.length && includesAny(text, exclude)) {
    score -= 0.35;
    reasons.push("matches_excluded");
  }

  // Prefer items with a direct URL.
  if (item.url.startsWith("http")) {
    score += 0.1;
    reasons.push("has_url");
  }

  // Clamp
  score = Math.max(0, Math.min(1, score));

  return { ...item, score, reasons };
}

function formatNote(
  item: SelectedItem,
  personaName = "Traveler",
): { title: string; content: string } {
  const title = `[${item.source}] ${item.title}`.slice(0, 200);
  const lines = [
    `Source: ${item.url}`,
    item.publishedAt ? `Published: ${item.publishedAt}` : "",
    "",
    item.summary ? `Summary: ${item.summary}` : "",
    "",
    `Why I picked this: score=${item.score.toFixed(2)} (${item.reasons.join(", ")})`,
    "",
    `— ${personaName}`,
  ].filter((l) => l !== "");

  return { title, content: lines.join("\n") };
}

export async function runOnce(cfg: TravelerConfig): Promise<void> {
  const sources = cfg.sources ?? [];
  const personaName = cfg.persona?.name ?? "Traveler";

  const limit = cfg.ranking?.daily_limit ?? 3;
  const minScore = cfg.ranking?.min_score ?? 0.65;
  const dedupeDays = cfg.ranking?.dedupe_window_days ?? 14;

  const all: FeedItem[] = [];
  for (const src of sources) {
    if (src.type === "rss") {
      const items = await fetchRss(src.url, src.name ?? "rss");
      all.push(...items);
    }
  }

  const scored = all
    .filter((i) => !isSeen(i.url, dedupeDays))
    .map((i) => scoreItem(i, cfg))
    .sort((a, b) => b.score - a.score);

  const picked = scored.filter((i) => i.score >= minScore).slice(0, limit);

  if (!picked.length) {
    console.log("No items selected today.");
    return;
  }

  const tags = cfg.output?.rote?.tags ?? ["inbox", "traveler"];

  for (const item of picked) {
    const note = formatNote(item, personaName);
    const created = await createRoteNote({
      title: note.title,
      content: note.content,
      state: "private",
      type: "rote",
      tags,
      pin: false,
    });
    markSeen(item.url);
    console.log(`Wrote note: ${created.id} ${created.title}`);
  }
}