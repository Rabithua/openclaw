import { handleGithubWebhook } from './src/handlers/github.ts';
import { errorJson, json } from './src/utils/http.ts';

/**
 * Generic webhook receiver.
 *
 * Design: this service only verifies & normalizes incoming webhooks,
 * then forwards them to OpenClaw (Gateway /tools/invoke).
 *
 * Env:
 *  - PORT (default 8787)
 *  - WEBHOOK_PATH (default /webhook)
 *  - OPENCLAW_GATEWAY_URL (default http://127.0.0.1:18789)
 *  - OPENCLAW_GATEWAY_TOKEN (required)
 *
 * GitHub:
 *  - GITHUB_WEBHOOK_SECRET (required)
 */

const PORT = Number(Deno.env.get('PORT') ?? '8787');
const WEBHOOK_PATH = Deno.env.get('WEBHOOK_PATH') ?? '/webhook';

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  try {
    if (req.method === 'GET' && url.pathname === '/healthz') {
      return json({ ok: true, service: 'webhookd' });
    }

    if (req.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }

    if (url.pathname !== WEBHOOK_PATH) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    // GitHub webhook requests include X-GitHub-Event
    const ghEvent = req.headers.get('x-github-event');
    if (ghEvent) {
      return await handleGithubWebhook(req);
    }

    return json({ ok: false, error: 'unknown_webhook_source' }, 400);
  } catch (err) {
    const requestId = crypto.randomUUID();
    console.error('webhookd_unhandled_error', { requestId, err });
    return errorJson(err, 500, { requestId });
  }
});

console.log(`webhookd listening on http://127.0.0.1:${PORT}${WEBHOOK_PATH}`);
