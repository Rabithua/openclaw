type RoteResponse<T> = { code: number; message: string; data: T };

type CreateNotePayload = {
  content: string;
  title?: string;
  state?: string;
  type?: string;
  tags?: string[];
  pin?: boolean;
};

function apiBase(): string {
  const base = (Deno.env.get("ROTE_API_BASE") ?? "").trim();
  if (!base) throw new Error("Missing ROTE_API_BASE");
  return base.replace(/\/+$/, "");
}

function openKey(): string {
  const k = (Deno.env.get("ROTE_OPENKEY") ?? "").trim();
  if (!k) throw new Error("Missing ROTE_OPENKEY");
  return k;
}

async function roteRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(apiBase() + path);
  url.searchParams.set("openkey", openKey());

  const resp = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify({ openkey: openKey(), ...body }) : undefined,
  });

  const text = await resp.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!resp.ok) {
    throw new Error(
      `Rote HTTP ${resp.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`,
    );
  }

  const parsed = data as RoteResponse<T>;
  if (parsed?.code !== 0) {
    throw new Error(`Rote error: ${parsed?.message ?? "unknown"}`);
  }

  return parsed.data;
}

export async function createRoteNote(
  payload: CreateNotePayload,
): Promise<{ id: string; title: string; content: string }> {
  return await roteRequest("POST", "/openkey/notes", payload);
}