import { handleGithubWebhook } from './src/handlers/github.ts';
import { errorJson, json } from './src/utils/http.ts';
import { logError, logInfo, logWarn } from './src/utils/logger.ts';

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

const PORT = Number(Deno.env.get('WEBHOOKD_PORT') ?? Deno.env.get('PORT') ?? '8787');
const HOST = Deno.env.get('WEBHOOKD_HOST') ?? '0.0.0.0';
const WEBHOOK_PATH = Deno.env.get('WEBHOOK_PATH') ?? '/webhook';

Deno.serve({ hostname: HOST, port: PORT }, async (req) => {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  const url = new URL(req.url);
  logInfo('request_start', {
    requestId,
    method: req.method,
    path: url.pathname,
  });

  try {
    if (req.method === 'GET' && url.pathname === '/healthz') {
      const response = json({ ok: true, service: 'webhookd' });
      logInfo('request_end', {
        requestId,
        method: req.method,
        path: url.pathname,
        status: response.status,
        duration_ms: Date.now() - start,
      });
      return response;
    }

    if (req.method !== 'POST') {
      const response = json({ ok: false, error: 'method_not_allowed' }, 405);
      logWarn('request_method_not_allowed', {
        requestId,
        method: req.method,
        path: url.pathname,
      });
      logInfo('request_end', {
        requestId,
        method: req.method,
        path: url.pathname,
        status: response.status,
        duration_ms: Date.now() - start,
      });
      return response;
    }

    if (url.pathname !== WEBHOOK_PATH) {
      const response = json({ ok: false, error: 'not_found' }, 404);
      logInfo('request_end', {
        requestId,
        method: req.method,
        path: url.pathname,
        status: response.status,
        duration_ms: Date.now() - start,
      });
      return response;
    }

    // GitHub webhook requests include X-GitHub-Event
    const ghEvent = req.headers.get('x-github-event');
    if (ghEvent) {
      const response = await handleGithubWebhook(req, requestId);
      logInfo('request_end', {
        requestId,
        method: req.method,
        path: url.pathname,
        status: response.status,
        duration_ms: Date.now() - start,
      });
      return response;
    }

    const response = json({ ok: false, error: 'unknown_webhook_source' }, 400);
    logWarn('unknown_webhook_source', { requestId });
    logInfo('request_end', {
      requestId,
      method: req.method,
      path: url.pathname,
      status: response.status,
      duration_ms: Date.now() - start,
    });
    return response;
  } catch (err) {
    logError('webhookd_unhandled_error', { requestId, error: String(err) });
    const response = errorJson(err, 500, { requestId });
    logInfo('request_end', {
      requestId,
      method: req.method,
      path: url.pathname,
      status: response.status,
      duration_ms: Date.now() - start,
    });
    return response;
  }
});

logInfo('server_listening', {
  host: HOST,
  port: PORT,
  url: `http://${HOST}:${PORT}${WEBHOOK_PATH}`,
  local_url: `http://127.0.0.1:${PORT}${WEBHOOK_PATH}`,
  routes: [`POST ${WEBHOOK_PATH}`, 'GET /healthz'],
});
