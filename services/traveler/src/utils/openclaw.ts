import { json } from "./http.ts";

type OpenClawInvokeArgs = {
  gatewayUrl: string; // e.g. http://127.0.0.1:18789
  gatewayToken: string;
  tool: string;
  action?: string;
  toolArgs?: Record<string, unknown>;
  sessionKey?: string;
  headers?: Record<string, string>;
};

export async function openclawToolsInvoke(
  args: OpenClawInvokeArgs,
): Promise<unknown> {
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
      authorization: `Bearer ${gatewayToken}`,
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
      `openclaw_invoke_failed status=${resp.status} body=${
        String(text).slice(0, 500)
      }`,
    );
  }

  return data;
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name) ?? "";
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

export function okJson(extra?: Record<string, unknown>): Response {
  return json({ ok: true, ...(extra ?? {}) });
}
