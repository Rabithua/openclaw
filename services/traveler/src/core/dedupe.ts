import { ensureDirSync } from "jsr:@std/fs/ensure-dir";
import { join } from "jsr:@std/path/join";

const STATE_DIR = Deno.env.get("TRAVELER_STATE_DIR") ?? "state";
const STATE_FILE = join(STATE_DIR, "seen.json");

type SeenState = {
  seen: Record<string, number>; // url -> unixMs
};

function loadState(): SeenState {
  try {
    const raw = Deno.readTextFileSync(STATE_FILE);
    const obj = JSON.parse(raw) as SeenState;
    if (!obj?.seen) return { seen: {} };
    return obj;
  } catch {
    return { seen: {} };
  }
}

function saveState(st: SeenState): void {
  ensureDirSync(STATE_DIR);
  Deno.writeTextFileSync(STATE_FILE, JSON.stringify(st, null, 2) + "\n");
}

export function markSeen(url: string, nowMs = Date.now()): void {
  const st = loadState();
  st.seen[url] = nowMs;
  saveState(st);
}

export function isSeen(
  url: string,
  windowDays: number,
  nowMs = Date.now(),
): boolean {
  const st = loadState();
  const ts = st.seen[url];
  if (!ts) return false;
  const winMs = windowDays * 24 * 60 * 60 * 1000;
  return nowMs - ts < winMs;
}