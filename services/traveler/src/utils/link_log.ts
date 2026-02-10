import type { FeedItem } from "../core/types.ts";

export type LoggedLink = {
  index: number;
  source: string;
  title: string;
  url: string;
  url_hash: string;
};

// Stable 64-bit FNV-1a hash for compact URL correlation in logs.
function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mod = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mod;
  }
  return hash.toString(16).padStart(16, "0");
}

export function buildLoggedLinks(items: FeedItem[]): LoggedLink[] {
  return items.map((item, index) => ({
    index: index + 1,
    source: item.source,
    title: item.title,
    url: item.url,
    url_hash: fnv1a64(item.url),
  }));
}
