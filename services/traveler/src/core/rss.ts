import { XMLParser } from "fast-xml-parser";
import type { FeedItem } from "./types.ts";

function clip(s: unknown, max = 20_000): string {
  const t = String(s ?? "").trim();
  return t.length > max ? t.slice(0, max) : t;
}

export async function fetchRss(
  url: string,
  sourceName = "rss",
): Promise<FeedItem[]> {
  const resp = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.1",
    },
  });
  if (!resp.ok) throw new Error(`rss_fetch_failed ${resp.status} ${url}`);

  const xml = await resp.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as any;

  const channel = parsed?.rss?.channel ?? parsed?.feed ?? null;
  const itemsRaw = channel?.item ?? [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

  return items
    .map((it: any) => {
      const title = clip(it?.title);
      const link = clip(it?.link?.["#text"] ?? it?.link ?? "");
      const pubDate = clip(it?.pubDate ?? it?.published ?? it?.updated ?? "");
      const description = clip(it?.description ?? it?.summary ?? "");
      if (!title || !link) return null;
      return {
        source: sourceName,
        title,
        url: link,
        publishedAt: pubDate || undefined,
        summary: description || undefined,
      } satisfies FeedItem;
    })
    .filter(Boolean) as FeedItem[];
}
