export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

type NormalizedError = {
  error: string;
  detail?: string;
};

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof Error) {
    const msg = err.message || 'unknown_error';
    if (msg.startsWith('missing_env:')) {
      return { error: 'missing_env', detail: msg.slice('missing_env:'.length) };
    }
    if (msg.startsWith('openclaw_invoke_failed')) {
      return { error: 'openclaw_invoke_failed', detail: msg };
    }
    return { error: 'internal_error', detail: msg };
  }

  if (typeof err === 'string') {
    return { error: 'internal_error', detail: err };
  }

  return { error: 'internal_error' };
}

export function errorJson(
  err: unknown,
  status = 500,
  extra?: Record<string, unknown>,
): Response {
  const normalized = normalizeError(err);
  return json({ ok: false, ...normalized, ...(extra ?? {}) }, status);
}
