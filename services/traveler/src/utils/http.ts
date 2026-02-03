export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  return JSON.parse(text);
}
