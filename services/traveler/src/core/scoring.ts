import type { FeedItem, SelectedItem, TravelerConfig } from "./types.ts";
import { openclawToolsInvoke } from "../utils/openclaw.ts";

function includesAny(hay: string, needles: string[]): boolean {
  const h = hay.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreItemHeuristic(item: FeedItem, cfg: TravelerConfig): SelectedItem {
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

  if (item.url.startsWith("http")) {
    score += 0.1;
    reasons.push("has_url");
  }

  score = clamp01(score);

  return { ...item, score, reasons };
}

function getOpenClawConfig():
  | { gatewayUrl: string; gatewayToken: string }
  | null {
  const gatewayUrl = (Deno.env.get("OPENCLAW_GATEWAY_URL") ?? "").trim();
  const gatewayToken = (Deno.env.get("OPENCLAW_GATEWAY_TOKEN") ?? "").trim();
  if (!gatewayUrl || !gatewayToken) return null;
  return { gatewayUrl, gatewayToken };
}

function formatTask(
  items: FeedItem[],
  cfg: TravelerConfig,
  sourceLabel: string,
): string {
  const persona = cfg.persona?.name ?? "Traveler";
  const minScore = cfg.ranking?.min_score ?? 0.3;
  const dedupeDays = cfg.ranking?.dedupe_window_days ?? 7;
  const tags = cfg.output?.rote?.tags ?? ["inbox", "traveler"];
  const roteEnabled = cfg.output?.rote?.enabled ?? true;

  return [
    "You are OpenClaw. Please score the following feed items for relevance.",
    "Return a concise summary and, if Rote is enabled, create notes for accepted items.",
    "",
    `Persona: ${persona}`,
    `Minimum score: ${minScore}`,
    `Dedupe window (days): ${dedupeDays}`,
    `Rote enabled: ${roteEnabled}`,
    `Rote tags: ${tags.join(", ")}`,
    "",
    "Rules:",
    "- Score each item on a 0-1 scale with short reasons.",
    "- Reject items below minimum score.",
    "- If Rote is enabled, create one note per accepted item.",
    "- Note format:",
    "  Title: [source] title (max 200 chars)",
    "  Body: Source URL, Published (if any), Summary, Score + reasons.",
    "- If Rote is disabled, just return the scored list in your response.",
    "",
    `Source label: ${sourceLabel}`,
    "Items (JSON):",
    JSON.stringify(items),
  ].join("\n");
}

export function shouldUseOpenClawScoring(): boolean {
  return getOpenClawConfig() !== null;
}

export async function forwardItemsToOpenClaw(args: {
  items: FeedItem[];
  cfg: TravelerConfig;
  sourceLabel: string;
}): Promise<{ ok: boolean; sessionLabel: string } | null> {
  const openclaw = getOpenClawConfig();
  if (!openclaw) return null;

  const { items, cfg, sourceLabel } = args;
  if (!items.length) return { ok: true, sessionLabel: "" };

  const label = `traveler:score:${sourceLabel}:${new Date().toISOString()}`;
  const task = formatTask(items, cfg, sourceLabel);

  await openclawToolsInvoke({
    gatewayUrl: openclaw.gatewayUrl,
    gatewayToken: openclaw.gatewayToken,
    tool: "sessions_spawn",
    toolArgs: {
      label,
      task,
      cleanup: "keep",
      runTimeoutSeconds: 600,
    },
  });

  return { ok: true, sessionLabel: label };
}

export function scoreItem(
  item: FeedItem,
  cfg: TravelerConfig,
): SelectedItem {
  return scoreItemHeuristic(item, cfg);
}
