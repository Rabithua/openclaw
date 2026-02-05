import { parse as parseYaml } from "@std/yaml";
import { runOnce } from "./core/pipeline.ts";
import { handleSubmit, type SubmitRequest } from "./handlers/submit.ts";
import { json } from "./utils/http.ts";
import {
  getAuthToken,
  getSignature,
  validateApiToken,
  validateHmacSignature,
} from "./utils/auth.ts";
import type { TravelerConfig } from "./core/types.ts";
import { logError, logInfo, logWarn } from "./utils/logger.ts";

const PORT = Number(Deno.env.get("TRAVELER_PORT") ?? "8788");
const API_TOKEN = Deno.env.get("TRAVELER_API_TOKEN");
const HMAC_SECRET = Deno.env.get("TRAVELER_HMAC_SECRET");
const CONFIG_PATH = Deno.env.get("TRAVELER_CONFIG") ?? "configs/default.yaml";
const SCHEDULE_INTERVAL_MINUTES = Number(
  Deno.env.get("TRAVELER_SCHEDULE_INTERVAL_MINUTES") ?? "0",
);
const SCHEDULE_RUN_ON_START = (Deno.env.get("TRAVELER_SCHEDULE_RUN_ON_START") ??
  "true").toLowerCase() === "true";

let config: TravelerConfig;
let scheduleRunning = false;

async function loadConfig(): Promise<TravelerConfig> {
  const text = await Deno.readTextFile(CONFIG_PATH);
  return parseYaml(text) as TravelerConfig;
}

async function runScheduled(): Promise<void> {
  if (scheduleRunning) {
    logWarn("schedule_skip_running");
    return;
  }

  scheduleRunning = true;
  try {
    if (!config) {
      config = await loadConfig();
    }
    await runOnce(config);
  } catch (e) {
    logError("schedule_run_failed", { error: String(e) });
  } finally {
    scheduleRunning = false;
  }
}

async function authenticate(req: Request, body: string): Promise<boolean> {
  // Method 1: API Token
  const token = getAuthToken(req.headers);
  if (token && validateApiToken(token, API_TOKEN)) {
    return true;
  }

  // Method 2: HMAC Signature
  const signature = getSignature(req.headers);
  if (signature && HMAC_SECRET) {
    try {
      return await validateHmacSignature(body, signature, HMAC_SECRET);
    } catch (e) {
      console.error("HMAC validation error:", e);
      return false;
    }
  }

  return false;
}

Deno.serve({ port: PORT }, async (req) => {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  const url = new URL(req.url);
  logInfo("request_start", {
    requestId,
    method: req.method,
    path: url.pathname,
  });

  // Health check
  if (req.method === "GET" && url.pathname === "/healthz") {
    const response = json({ ok: true, service: "traveler" });
    logInfo("request_end", {
      requestId,
      method: req.method,
      path: url.pathname,
      status: response.status,
      duration_ms: Date.now() - start,
    });
    return response;
  }

  // Submit endpoint
  if (req.method === "POST" && url.pathname === "/traveler/submit") {
    let response: Response | undefined;
    try {
      const body = await req.text();

      // Authenticate request
      const authenticated = await authenticate(req, body);
      if (!authenticated) {
        logWarn("submit_unauthorized", { requestId });
        response = json(
          { ok: false, error: "unauthorized: invalid or missing credentials" },
          401,
        );
        return response;
      }

      // Parse and validate request
      let submitReq: SubmitRequest;
      try {
        submitReq = JSON.parse(body) as SubmitRequest;
      } catch (e) {
        logWarn("submit_invalid_json", { requestId, error: String(e) });
        response = json({ ok: false, error: "invalid_json" }, 400);
        return response;
      }

      // Load config if not already loaded
      if (!config) {
        config = await loadConfig();
      }

      logInfo("submit_received", {
        requestId,
        source_name: submitReq.source_name,
        feed_items: submitReq.feed_items?.length ?? 0,
      });

      // Process submission
      const result = await handleSubmit(submitReq, config);
      logInfo("submit_processed", {
        requestId,
        ok: result.ok,
        processed: result.processed ?? 0,
        rejected: result.rejected ?? 0,
        error: result.error ?? null,
      });
      response = json(result, result.ok ? 200 : 400);
      return response;
    } catch (e) {
      logError("submit_unhandled_error", { requestId, error: String(e) });
      response = json({ ok: false, error: "internal_error" }, 500);
      return response;
    } finally {
      if (response) {
        logInfo("request_end", {
          requestId,
          method: req.method,
          path: url.pathname,
          status: response.status,
          duration_ms: Date.now() - start,
        });
      }
    }
  }

  // 404
  const response = json({ ok: false, error: "not_found" }, 404);
  logInfo("request_end", {
    requestId,
    method: req.method,
    path: url.pathname,
    status: response.status,
    duration_ms: Date.now() - start,
  });
  return response;
});

logInfo("server_listening", {
  url: `http://127.0.0.1:${PORT}`,
  routes: ["POST /traveler/submit", "GET /healthz"],
});

if (SCHEDULE_INTERVAL_MINUTES > 0) {
  const intervalMs = Math.floor(SCHEDULE_INTERVAL_MINUTES * 60_000);
  logInfo("schedule_enabled", {
    minutes: SCHEDULE_INTERVAL_MINUTES,
    run_on_start: SCHEDULE_RUN_ON_START,
  });
  if (SCHEDULE_RUN_ON_START) {
    setTimeout(() => {
      runScheduled();
    }, 0);
  }
  setInterval(() => {
    runScheduled();
  }, intervalMs);
}
