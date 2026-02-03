import type { FeedItem, TravelerConfig } from "../core/types.ts";
import { isSeen, markSeen } from "../core/dedupe.ts";
import { createRoteNote } from "../core/rote.ts";

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

  const rankingCfg = cfg.ranking ?? {};
  const dedupeWindowDays = rankingCfg.dedupe_window_days ?? 7;

  const items: FeedItem[] = req.feed_items
    .filter((item) => item.title && item.url)
    .map((item) => ({
      source: req.source_name,
      title: item.title,
      url: item.url,
      summary: item.summary,
      publishedAt: item.published_at,
    }));

  let processed = 0;
  let rejected = 0;

  for (const item of items) {
    const key = `${item.source}:${item.url}`;
    if (isSeen(key, dedupeWindowDays)) {
      rejected++;
      continue;
    }

    markSeen(key);

    // Score and process the item
    const score = scoreItemSimple(item, cfg);
    const minScore = rankingCfg.min_score ?? 0.3;

    if (score < minScore) {
      rejected++;
      continue;
    }

    // Write to Rote
    const note = formatNoteSimple(item, cfg.persona?.name ?? "Traveler");
    try {
      const tags = cfg.output?.rote?.tags ?? ["inbox", "traveler"];
      await createRoteNote({
        title: note.title,
        content: note.content,
        state: "private",
        type: "rote",
        tags,
        pin: false,
      });
      processed++;
    } catch (e) {
      console.error(`Failed to create note for ${item.url}:`, e);
      rejected++;
    }
  }

  return {
    ok: true,
    processed,
    rejected,
    message: `Processed ${processed} item(s), rejected ${rejected} item(s)`,
  };
}

function scoreItemSimple(item: FeedItem, cfg: TravelerConfig): number {
  const include = cfg.interests?.include ?? [];
  const exclude = cfg.interests?.exclude ?? [];
  const text = `${item.title}\n${item.summary ?? ""}`.toLowerCase();

  let score = 0.5;

  if (include.length && include.some((n) => text.includes(n.toLowerCase()))) {
    score += 0.25;
  }

  if (exclude.length && exclude.some((n) => text.includes(n.toLowerCase()))) {
    score -= 0.35;
  }

  if (item.url.startsWith("http")) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

function formatNoteSimple(
  item: FeedItem,
  personaName = "Traveler",
): { title: string; content: string } {
  const title = `[${item.source}] ${item.title}`.slice(0, 200);
  const lines = [
    `Source: ${item.url}`,
    item.publishedAt ? `Published: ${item.publishedAt}` : "",
    "",
    item.summary ? item.summary : "No summary provided.",
  ];

  const content = lines.filter(Boolean).join("\n");
  return { title, content };
}
