import { ensureDirSync } from "@std/fs/ensure-dir";
import { dirname, join } from "@std/path";
import { Database } from "@db/sqlite";

const STATE_DIR = Deno.env.get("TRAVELER_STATE_DIR") ?? ".local/state";
const DB_PATH = Deno.env.get("TRAVELER_DB_PATH") ??
  join(STATE_DIR, "traveler.db");
const LEGACY_STATE_FILES = Array.from(
  new Set([join("state", "seen.json"), join(STATE_DIR, "seen.json")]),
);

type SeenState = {
  seen: Record<string, number>; // url -> unixMs
};

let db: Database | null = null;

function ensureSchema(sqlite: Database): void {
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS seen_links (
      url TEXT PRIMARY KEY,
      seen_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_seen_links_seen_at_ms ON seen_links (seen_at_ms);
  `);
}

function loadLegacyState(path: string): SeenState | null {
  try {
    const raw = Deno.readTextFileSync(path);
    const obj = JSON.parse(raw) as SeenState;
    if (!obj?.seen || typeof obj.seen !== "object") return null;
    return obj;
  } catch {
    return null;
  }
}

function migrateLegacyStateIfNeeded(sqlite: Database): void {
  const countStmt = sqlite.prepare("SELECT COUNT(*) AS count FROM seen_links");
  const row = countStmt.get() as { count: number };
  countStmt.finalize();
  if (row.count > 0) return;

  for (const file of LEGACY_STATE_FILES) {
    const legacy = loadLegacyState(file);
    if (!legacy) continue;

    const upsert = sqlite.prepare(
      `INSERT INTO seen_links (url, seen_at_ms)
       VALUES (?, ?)
       ON CONFLICT(url) DO UPDATE SET seen_at_ms = excluded.seen_at_ms`,
    );

    for (const [url, seenAtMs] of Object.entries(legacy.seen)) {
      if (!url || !Number.isFinite(seenAtMs)) continue;
      upsert.run(url, Math.floor(seenAtMs));
    }
    upsert.finalize();

    try {
      Deno.renameSync(file, `${file}.migrated`);
    } catch {
      // ignore: migration already happened or file is read-only
    }
    break;
  }
}

function getDb(): Database {
  if (!db) {
    ensureDirSync(dirname(DB_PATH));
    db = new Database(DB_PATH);
    ensureSchema(db);
    migrateLegacyStateIfNeeded(db);
  }
  return db;
}

export function markSeen(url: string, nowMs = Date.now()): void {
  const sqlite = getDb();
  sqlite.run(
    `INSERT INTO seen_links (url, seen_at_ms)
     VALUES (?, ?)
     ON CONFLICT(url) DO UPDATE SET seen_at_ms = excluded.seen_at_ms`,
    [url, nowMs],
  );
}

export function isSeen(
  url: string,
  windowDays: number,
  nowMs = Date.now(),
): boolean {
  const sqlite = getDb();
  const winMs = windowDays * 24 * 60 * 60 * 1000;
  const minSeenAtMs = nowMs - winMs;
  const stmt = sqlite.prepare(
    "SELECT 1 AS seen FROM seen_links WHERE url = ? AND seen_at_ms > ? LIMIT 1",
  );
  const row = stmt.get(url, minSeenAtMs) as { seen?: number } | undefined;
  stmt.finalize();
  return row?.seen === 1;
}
