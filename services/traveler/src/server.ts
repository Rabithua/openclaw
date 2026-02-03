import { parse as parseYaml } from "jsr:@std/yaml";
import { handleSubmit, type SubmitRequest } from "./handlers/submit.ts";
import { json, readJsonBody } from "./utils/http.ts";
import { validateApiToken, validateHmacSignature, getAuthToken, getSignature } from "./utils/auth.ts";
import type { TravelerConfig } from "./core/types.ts";

const PORT = Number(Deno.env.get("TRAVELER_PORT") ?? "8788");
const API_TOKEN = Deno.env.get("TRAVELER_API_TOKEN");
const HMAC_SECRET = Deno.env.get("TRAVELER_HMAC_SECRET");
const CONFIG_PATH = Deno.env.get("TRAVELER_CONFIG") ?? "configs/default.yaml";

let config: TravelerConfig;

async function loadConfig(): Promise<TravelerConfig> {
  const text = await Deno.readTextFile(CONFIG_PATH);
  return parseYaml(text) as TravelerConfig;
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
  const url = new URL(req.url);

  // Health check
  if (req.method === "GET" && url.pathname === "/healthz") {
    return json({ ok: true, service: "traveler" });
  }

  // Submit endpoint
  if (req.method === "POST" && url.pathname === "/traveler/submit") {
    try {
      const body = await req.text();

      // Authenticate request
      const authenticated = await authenticate(req, body);
      if (!authenticated) {
        return json(
          { ok: false, error: "unauthorized: invalid or missing credentials" },
          401,
        );
      }

      // Parse and validate request
      let submitReq: SubmitRequest;
      try {
        submitReq = JSON.parse(body) as SubmitRequest;
      } catch (e) {
        return json({ ok: false, error: "invalid_json" }, 400);
      }

      // Load config if not already loaded
      if (!config) {
        config = await loadConfig();
      }

      // Process submission
      const result = await handleSubmit(submitReq, config);
      return json(result, result.ok ? 200 : 400);
    } catch (e) {
      console.error("Error in /traveler/submit handler:", e);
      return json({ ok: false, error: "internal_error" }, 500);
    }
  }

  // 404
  return json({ ok: false, error: "not_found" }, 404);
});

console.log(`✓ Traveler submit server listening on http://127.0.0.1:${PORT}`);
console.log(`  POST /traveler/submit - Submit feed items`);
console.log(`  GET  /healthz       - Health check`);
