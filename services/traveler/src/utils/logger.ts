type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SERVICE = "traveler";
const LOG_LEVEL = ((Deno.env.get("TRAVELER_LOG_LEVEL") ??
  Deno.env.get("LOG_LEVEL") ?? "info")
  .trim()
  .toLowerCase() as LogLevel) in LEVELS
  ? ((Deno.env.get("TRAVELER_LOG_LEVEL") ?? Deno.env.get("LOG_LEVEL") ??
    "info").trim().toLowerCase() as LogLevel)
  : "info";

export function log(
  level: LogLevel,
  msg: string,
  fields: Record<string, unknown> = {},
): void {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    msg,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function logInfo(msg: string, fields?: Record<string, unknown>): void {
  log("info", msg, fields);
}

export function logWarn(msg: string, fields?: Record<string, unknown>): void {
  log("warn", msg, fields);
}

export function logError(msg: string, fields?: Record<string, unknown>): void {
  log("error", msg, fields);
}
