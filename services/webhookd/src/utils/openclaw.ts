import { json } from "./http.ts";

export async function openclawToolsInvoke(args: {
  gatewayUrl: string; // e.g. http://127.0.0.1:18789
  gatewayToken: string;
  tool: string;
  action?: string;
  toolArgs?: Record<string, unknown>;
  sessionKey?: string;
  headers?: Record<string, string>;
}): Promise<unknown> {
  const {
    gatewayUrl,
    gatewayToken,
    tool,
    action,
    toolArgs,
    sessionKey,
    headers,
  } = args;

  const url = gatewayUrl.replace(/\/$/, "") + "/tools/invoke";

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${gatewayToken}`,
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify({
      tool,
      action,
      args: toolArgs ?? {},
      sessionKey,
    }),
  });

  const text = await resp.text().catch(() => "");
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!resp.ok) {
    throw new Error(
      `openclaw_invoke_failed status=${resp.status} body=${text.slice(0, 500)}`,
    );
  }

  const internalError = detectInternalInvokeError(data);
  if (internalError) {
    throw new Error(
      `openclaw_invoke_internal_error ${withPairingHint(internalError)}`,
    );
  }

  return data;
}

type OpenClawSpawnSessionArgs = {
  gatewayUrl: string;
  gatewayToken: string;
  toolArgs?: Record<string, unknown>;
  sessionKey?: string;
  headers?: Record<string, string>;
};

function isToolUnavailableError(error: unknown, toolName: string): boolean {
  const msg = String(error ?? "");
  return msg.includes("openclaw_invoke_failed") &&
    msg.includes("status=404") &&
    msg.includes(`Tool not available: ${toolName}`);
}

export async function openclawSpawnSession(
  args: OpenClawSpawnSessionArgs,
): Promise<unknown> {
  try {
    return await openclawToolsInvoke({
      ...args,
      tool: "sessions_spawn",
    });
  } catch (error) {
    if (!isToolUnavailableError(error, "sessions_spawn")) {
      throw error;
    }
  }

  // Compatibility fallback for gateways that expose sessions tool/action.
  return await openclawToolsInvoke({
    ...args,
    tool: "sessions",
    action: "spawn",
  });
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name) ?? "";
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

export function okJson(extra?: Record<string, unknown>): Response {
  return json({ ok: true, ...(extra ?? {}) });
}

function detectInternalInvokeError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const root = data as Record<string, unknown>;
  if (root.ok === false) {
    const error = root.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const msg = (error as Record<string, unknown>).message;
      if (typeof msg === "string" && msg) return msg;
    }
    return "invoke returned ok=false";
  }

  const details = (
      root.result &&
      typeof root.result === "object" &&
      (root.result as Record<string, unknown>).details &&
      typeof (root.result as Record<string, unknown>).details === "object"
    )
    ? (root.result as Record<string, unknown>).details as Record<
      string,
      unknown
    >
    : null;

  if (details?.status === "error") {
    const msg = details.error;
    if (typeof msg === "string" && msg) return msg;
    return "result.details.status=error";
  }

  return null;
}

function withPairingHint(message: string): string {
  if (!message.toLowerCase().includes("pairing required")) return message;
  return `${message} (gateway device not paired; run: openclaw devices list, then openclaw doctor --repair or approve pending device/pairing in OpenClaw UI)`;
}
